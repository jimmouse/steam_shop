# BEpusdt 联调：下单 → 发起链上支付（建单、拿地址/金额/二维码）→ 换链 → 伪造回调验签 → 网关后台标记已付触发真实回调 → 自动发货 → 取消订单释放网关占用
# 前提：npm run dev 运行中；BEpusdt 在 :8080 运行且 .env 已配 BEPUSDT_GATEWAY / BEPUSDT_TOKEN / PAYMENT_NOTIFY_BASE_URL=http://host.docker.internal:3000
# 可选环境变量：BEPUSDT_ADMIN_USER / BEPUSDT_ADMIN_PASS / BEPUSDT_SECURE_PATH（不填则跳过「后台标记已付」步骤，只测伪造回调）
$ErrorActionPreference = "Stop"
$base = "http://localhost:3000"
$ez = "http://localhost:8080"
$token = (Get-Content .env -Encoding UTF8 | Where-Object { $_ -match '^BEPUSDT_TOKEN="?([^"]+)"?' } | ForEach-Object { $Matches[1] } | Select-Object -First 1)
if (-not $token) { throw ".env 里没有 BEPUSDT_TOKEN" }
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$docker = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
$mysql = @("exec", "-e", "MYSQL_PWD=my-secret-pw", "steam-mysql", "mysql", "-uroot", "-N", "steam_store", "-e")
$fail = 0

function Api($method, $path, $body) {
  $params = @{ Uri = "$base$path"; Method = $method; WebSession = $session; ContentType = "application/json"; UseBasicParsing = $true }
  if ($null -ne $body) { $params.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 5 -Compress)) }
  try { $r = Invoke-WebRequest @params }
  catch {
    $resp = $_.Exception.Response
    $txt = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
    Write-Host "  !! $method $path -> $([int]$resp.StatusCode) $txt" -ForegroundColor Yellow
    return $null
  }
  Write-Host "  $method $path -> $($r.StatusCode)" -ForegroundColor DarkGray
  return ($r.Content | ConvertFrom-Json).data
}
function Sql($q) { $ErrorActionPreference = "Continue"; $out = & $docker @mysql $q 2>$null; $ErrorActionPreference = "Stop"; return ($out | Select-Object -Last 1) }
function Check($cond, $msg) { if ($cond) { Write-Host "  ✓ $msg" -ForegroundColor Green } else { Write-Host "  ✗ $msg" -ForegroundColor Red; $script:fail++ } }
function Md5($s) { $md5 = [Security.Cryptography.MD5]::Create(); ($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($s)) | ForEach-Object { $_.ToString("x2") }) -join "" }
# 与 BEpusdt 一致：非空、非 signature，按 key 升序 k=v& 拼接，末尾加 token，MD5
function Sign($params) {
  $str = ($params.Keys | Where-Object { $_ -ne "signature" -and "$($params[$_])" -ne "" } | Sort-Object -Culture "" | ForEach-Object { "$_=$($params[$_])" }) -join "&"
  return Md5 ($str + $token)
}
function Notify($params, $label) {
  $json = ($params | ConvertTo-Json -Compress)
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$base/api/payments/bepusdt/notify" -ContentType "application/json" -Body $json
    Write-Host "  $label -> $($r.StatusCode) $($r.Content)" -ForegroundColor DarkGray; return $r.Content
  } catch {
    $resp = $_.Exception.Response; $txt = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
    Write-Host "  $label -> $([int]$resp.StatusCode) $txt" -ForegroundColor DarkGray; return $txt
  }
}

$stamp = Get-Date -Format "HHmmss"
$userEmail = "crypto$stamp@test.local"

Write-Host "`n[1] 注册用户 + 补库存"
Api POST "/api/auth/send-code" @{ email = $userEmail; purpose = "REGISTER" } | Out-Null
$code = (Sql "SELECT code FROM verification_codes WHERE email='$userEmail' AND purpose='REGISTER' ORDER BY created_at DESC LIMIT 1;").Trim()
$me = Api POST "/api/auth/register" @{ email = $userEmail; code = $code; password = "Password123" }
1..3 | ForEach-Object { Sql "INSERT INTO inventory_items (id, product_id, status, payload, created_at) SELECT CONCAT('inv$stamp', FLOOR(RAND()*1000000)), id, 'AVAILABLE', 'tr-$stamp-$_----pass----mail@x.com----mp', NOW() FROM products WHERE slug='tr-blank-account';" | Out-Null }

Write-Host "`n[2] 下单"
$order = Api POST "/api/orders" @{ productSlug = "tr-blank-account"; quantity = 1 }
Write-Host "  orderNo=$($order.orderNo) amount=$($order.amount) $($order.currency)"

Write-Host "`n[3] 发起 USDT · TRC20 支付"
$pay = Api POST "/api/orders/$($order.id)/pay" @{ provider = "BEPUSDT"; payType = "usdt.trc20" }
$m = $pay.payment.meta
Write-Host "  trade_id=$($m.tradeId) address=$($m.address) pay=$($m.uniqueAmount) $($m.payCurrency) net=$($m.network) rate=$($m.rate)"
Check ($m.payType -eq "usdt.trc20" -and $m.address -like "T*") "建单成功，拿到 Tron 地址"
Check ([double]$m.uniqueAmount -gt 0) "actual_amount > 0"
Check ($m.qrcode -like "data:image/png;base64,*") "服务端生成了二维码 data URL"
Check ($m.payUrl -like "http*/pay/checkout/*") "有收银台链接"

Write-Host "`n[4] 同链重复发起应复用同一条支付记录"
$pay2 = Api POST "/api/orders/$($order.id)/pay" @{ provider = "BEPUSDT"; payType = "usdt.trc20" }
Check ($pay2.payment.id -eq $pay.payment.id) "复用 payment $($pay.payment.id)"

Write-Host "`n[5] 换链到 USDT · BEP20：旧记录作废，新建单"
$pay3 = Api POST "/api/orders/$($order.id)/pay" @{ provider = "BEPUSDT"; payType = "usdt.bep20" }
$m3 = $pay3.payment.meta
Check ($pay3.payment.id -ne $pay.payment.id -and $m3.address -like "0x*") "新 payment，EVM 地址 $($m3.address)"
$oldStatus = (Sql "SELECT status FROM payments WHERE id='$($pay.payment.id)';").Trim()
Check ($oldStatus -eq "FAILED") "旧 TRC20 记录状态=$oldStatus"

Write-Host "`n[6] 伪造回调：错签名应被拒"
$bad = [ordered]@{ trade_id = $m3.tradeId; order_id = $pay3.payment.id; amount = [double]$order.amount; actual_amount = [double]$m3.uniqueAmount; token = $m3.address; block_transaction_id = ("ab" * 32); status = 2; signature = "deadbeef" }
$r = Notify $bad "bad sign"
Check ($r -like "fail*") "拒绝错误签名"
Check ((Sql "SELECT status FROM orders WHERE id='$($order.id)';").Trim() -eq "PENDING") "订单仍 PENDING"

Write-Host "`n[7] 伪造回调：正确签名但金额不符应被拒"
$wrong = [ordered]@{ trade_id = $m3.tradeId; order_id = $pay3.payment.id; amount = ([double]$order.amount + 1); actual_amount = [double]$m3.uniqueAmount; token = $m3.address; block_transaction_id = ("ab" * 32); status = 2 }
$wrong.signature = Sign $wrong
$r = Notify $wrong "wrong amount"
Check ($r -like "fail*金额*") "拒绝金额不符"

$adminUser = $env:BEPUSDT_ADMIN_USER; $adminPass = $env:BEPUSDT_ADMIN_PASS; $securePath = $env:BEPUSDT_SECURE_PATH
if ($adminUser -and $adminPass -and $securePath) {
  Write-Host "`n[8] 网关后台把订单标记为已支付 → BEpusdt 真实回调 host.docker.internal:3000 → 发货"
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  Invoke-WebRequest -UseBasicParsing -Uri "$ez/$securePath" -WebSession $s | Out-Null
  $login = Invoke-RestMethod -Method Post -Uri "$ez/api/auth/login" -WebSession $s -ContentType "application/json" -Body (@{ username = $adminUser; password = $adminPass } | ConvertTo-Json -Compress)
  $h = @{ Authorization = $login.data.token }
  $list = Invoke-RestMethod -Method Post -Uri "$ez/api/order/list" -WebSession $s -Headers $h -ContentType "application/json" -Body '{"page":1,"size":20,"sort":"desc"}'
  $gw = @($list.data) | Where-Object { $_.trade_id -eq $m3.tradeId } | Select-Object -First 1
  if (-not $gw) { $gw = @($list.data.list) | Where-Object { $_.trade_id -eq $m3.tradeId } | Select-Object -First 1 }
  Check ($null -ne $gw) "在网关后台找到订单 id=$($gw.id)"
  $paid = Invoke-RestMethod -Method Post -Uri "$ez/api/order/paid" -WebSession $s -Headers $h -ContentType "application/json" -Body (@{ id = $gw.id; ref_hash = ("cd" * 32) } | ConvertTo-Json -Compress)
  Write-Host "  paid -> $($paid.code) $($paid.msg)"
  $deadline = (Get-Date).AddSeconds(20); $st = ""
  while ((Get-Date) -lt $deadline) { $st = (Sql "SELECT status FROM orders WHERE id='$($order.id)';").Trim(); if ($st -eq "DELIVERED" -or $st -eq "PAID") { break }; Start-Sleep 1 }
  Check ($st -eq "DELIVERED") "订单状态=$st（真实回调到达）"
  $tx = (Sql "SELECT tx_hash FROM payments WHERE id='$($pay3.payment.id)';").Trim()
  Check ($tx -eq ("cd" * 32)) "回调里的交易哈希已写入 payment.txHash"
} else {
  Write-Host "`n[8] 伪造正确回调（未提供 BEPUSDT_ADMIN_* 环境变量，跳过网关后台标记）"
  $good = [ordered]@{ trade_id = $m3.tradeId; order_id = $pay3.payment.id; amount = [double]$order.amount; actual_amount = [double]$m3.uniqueAmount; token = $m3.address; block_transaction_id = ("cd" * 32); status = 2 }
  $good.signature = Sign $good
  $r = Notify $good "good"
  Check ($r -eq "success") "回调返回 success"
  Check ((Sql "SELECT status FROM orders WHERE id='$($order.id)';").Trim() -eq "DELIVERED") "订单已发货"
  $r = Notify $good "replay"
  Check ($r -eq "success") "重复回调幂等返回 success"
}

Write-Host "`n[9] 取消待支付订单会让网关释放占用"
$o2 = Api POST "/api/orders" @{ productSlug = "tr-blank-account"; quantity = 1 }
$p4 = Api POST "/api/orders/$($o2.id)/pay" @{ provider = "BEPUSDT"; payType = "tron.trx" }
Check ($p4.payment.meta.payCurrency -eq "TRX") "TRX 原生币建单 $($p4.payment.meta.uniqueAmount) TRX"
Api POST "/api/orders/$($o2.id)/cancel" @{} | Out-Null
Check ((Sql "SELECT status FROM payments WHERE id='$($p4.payment.id)';").Trim() -eq "FAILED") "网关支付记录已作废"
Check ((Sql "SELECT status FROM orders WHERE id='$($o2.id)';").Trim() -eq "CANCELLED") "订单已取消"

Write-Host "`n[10] 超时回调（status=3）把支付记录标为 EXPIRED"
$o3 = Api POST "/api/orders" @{ productSlug = "tr-blank-account"; quantity = 1 }
$p5 = Api POST "/api/orders/$($o3.id)/pay" @{ provider = "BEPUSDT"; payType = "usdt.polygon" }
$exp = [ordered]@{ trade_id = $p5.payment.meta.tradeId; order_id = $p5.payment.id; amount = [double]$o3.amount; actual_amount = [double]$p5.payment.meta.uniqueAmount; token = $p5.payment.meta.address; status = 3 }
$exp.signature = Sign $exp
Notify $exp "timeout" | Out-Null
Check ((Sql "SELECT status FROM payments WHERE id='$($p5.payment.id)';").Trim() -eq "EXPIRED") "支付记录 EXPIRED"
Api POST "/api/orders/$($o3.id)/cancel" @{} | Out-Null

Write-Host ""
if ($fail -eq 0) { Write-Host "全部通过 ✓" -ForegroundColor Green } else { Write-Host "$fail 项失败 ✗" -ForegroundColor Red; exit 1 }
