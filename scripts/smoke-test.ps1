# 端到端冒烟测试：注册 → 下单 → 模拟支付 → 自动发货 → 工单 → 后台处理
# 用法：先 npm run dev，再在另一个终端执行 powershell -File scripts\smoke-test.ps1
$ErrorActionPreference = "Stop"
$base = "http://localhost:3000"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$admin = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$docker = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
$mysql = @("exec", "-e", "MYSQL_PWD=my-secret-pw", "steam-mysql", "mysql", "-uroot", "-N", "steam_store", "-e")

function Api($sess, $method, $path, $body) {
  $params = @{ Uri = "$base$path"; Method = $method; WebSession = $sess; ContentType = "application/json"; UseBasicParsing = $true }
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
function LatestCode($email, $purpose) {
  return (Sql "SELECT code FROM verification_codes WHERE email='$email' AND purpose='$purpose' ORDER BY created_at DESC LIMIT 1;").Trim()
}

$stamp = Get-Date -Format "HHmmss"
$userEmail = "buyer$stamp@test.local"
$adminEmail = "admin@example.com"

Write-Host "`n[1] 用户注册（邮箱验证码）"
Api $session POST "/api/auth/send-code" @{ email = $userEmail; purpose = "REGISTER" } | Out-Null
$code = LatestCode $userEmail "REGISTER"
Write-Host "  验证码(从DB读取): $code"
$me = Api $session POST "/api/auth/register" @{ email = $userEmail; code = $code; password = "Password123" }
Write-Host "  userId: $($me.userId)"

Write-Host "`n[1b] 补充测试库存（确保可重复运行）"
foreach ($slug in "tr-blank-account", "ar-blank-account") {
  1..3 | ForEach-Object { Sql "INSERT INTO inventory_items (id, product_id, status, payload, created_at) SELECT CONCAT('inv$stamp', FLOOR(RAND()*1000000)), id, 'AVAILABLE', '$slug-$stamp-$_----pass----mail@x.com----mp', NOW() FROM products WHERE slug='$slug';" | Out-Null }
}

Write-Host "`n[2] 错误密码登录应失败（预期 401）"
Api $session POST "/api/auth/login" @{ email = $userEmail; password = "wrong" } | Out-Null

Write-Host "`n[3] 商品列表"
$products = Api $session GET "/api/products"
$products | ForEach-Object { Write-Host "  $($_.slug) $($_.price) stock=$($_.stock)" }

Write-Host "`n[4] 下单：土耳其区账号 x2（锁库存）"
$stock0 = (Api $session GET "/api/products/tr-blank-account").stock
$order = Api $session POST "/api/orders" @{ productSlug = "tr-blank-account"; quantity = 2 }
Write-Host "  orderNo=$($order.orderNo) status=$($order.status) amount=$($order.amount)"
$stock1 = (Api $session GET "/api/products/tr-blank-account").stock
Write-Host "  库存 $stock0 -> $stock1 (应减 2)"

Write-Host "`n[5] 发起模拟支付 → 模拟回调"
$pay = Api $session POST "/api/orders/$($order.id)/pay" @{ provider = "MOCK" }
Api $session POST "/api/payments/mock/simulate" @{ paymentId = $pay.payment.id; status = "success" } | Out-Null
$o = Api $session GET "/api/orders/$($order.id)"
Write-Host "  订单状态: $($o.status) (应为 DELIVERED)"
Write-Host "  发货内容:`n$($o.deliveryPayload -replace '(?m)^', '    ')"

Write-Host "`n[6] 回调重放应幂等"
Api $session POST "/api/payments/mock/simulate" @{ paymentId = $pay.payment.id; status = "success" } | Out-Null
$o2 = Api $session GET "/api/orders/$($order.id)"
Write-Host "  状态仍为 $($o2.status)，payments=$($o2.payments.Count)"

Write-Host "`n[7] 代充下单（缺必填字段预期 400，补上后成功）"
$vid = (Api $session GET "/api/products/topup-tr").variants[0].id
Api $session POST "/api/orders" @{ productSlug = "topup-tr"; variantId = $vid } | Out-Null
Api $session POST "/api/orders" @{ productSlug = "topup-tr"; customerInput = @{ steam_login = "x" } } | Out-Null  # 缺规格预期 400
$topup = Api $session POST "/api/orders" @{ productSlug = "topup-tr"; variantId = $vid; customerInput = @{ steam_login = "my_steam_name" } }
Write-Host "  规格=$($topup.variantName) 金额=$($topup.amount) (应为 5 USD / 5.6)"
Write-Host "  orderNo=$($topup.orderNo)"

Write-Host "`n[8] 代充下单后创建支付记录（模拟支付商，不触发回调，留给后台人工确认）"
$upay = Api $session POST "/api/orders/$($topup.id)/pay" @{ provider = "MOCK" }
Write-Host "  payment=$($upay.payment.id) status=$($upay.payment.status) (应为 PENDING)"

Write-Host "`n[9] 管理员注册/登录"
Api $admin POST "/api/auth/send-code" @{ email = $adminEmail; purpose = "REGISTER" } | Out-Null
$acode = LatestCode $adminEmail "REGISTER"
$reg = $null
if ($acode) { $reg = Api $admin POST "/api/auth/register" @{ email = $adminEmail; code = $acode; password = "Admin123456" } }
if (-not $reg) { Api $admin POST "/api/auth/login" @{ email = $adminEmail; password = "Admin123456" } | Out-Null }
$adminMe = Api $admin GET "/api/me"
Write-Host "  role=$($adminMe.role) (应为 ADMIN)"

Write-Host "`n[10] 后台人工确认到账（附交易哈希）→ 自动开工单"
$pend = Api $admin GET "/api/admin/payments?status=PENDING"
$target = @($pend) | Where-Object { $_.orderId -eq $topup.id } | Select-Object -First 1
Api $admin POST "/api/admin/payments/$($target.id)/confirm" @{ txHash = ("a" * 64) } | Out-Null
$t = Api $session GET "/api/orders/$($topup.id)"
Write-Host "  订单状态: $($t.status) (应为 PROCESSING), 工单: $($t.tickets[0].ticketNo) type=$($t.tickets[0].type)"

Write-Host "`n[11] 用户追问 → 管理员回复 → 完成订单"
$tid = $t.tickets[0].id
Api $session POST "/api/tickets/$tid/messages" @{ body = "请问多久到账？" } | Out-Null
Api $admin POST "/api/admin/tickets/$tid/reply" @{ body = "正在处理，10 分钟内到账。" } | Out-Null
$tk = Api $session GET "/api/tickets/$tid"
Write-Host "  工单状态: $($tk.status) (应为 WAITING_USER) 消息数: $($tk.messages.Count) (应为 3)"
Api $admin POST "/api/admin/orders/$($topup.id)/complete" @{ deliveryPayload = "已充值 100 TL" } | Out-Null
$t2 = Api $session GET "/api/orders/$($topup.id)"
$tk2 = Api $session GET "/api/tickets/$tid"
Write-Host "  订单: $($t2.status) (DELIVERED) 工单: $($tk2.status) (RESOLVED)"

Write-Host "`n[12] 售前咨询工单"
$pre = Api $session POST "/api/tickets" @{ type = "PRESALE"; subject = "阿根廷区能改密码吗"; body = "买了以后能换绑邮箱吗？" }
Write-Host "  $($pre.ticketNo) $($pre.type)"

Write-Host "`n[13] 取消待支付订单 → 库存释放"
$c = Api $session POST "/api/orders" @{ productSlug = "ar-blank-account"; quantity = 1 }
$before = (Api $session GET "/api/products/ar-blank-account").stock
Api $session POST "/api/orders/$($c.id)/cancel" @{} | Out-Null
$after = (Api $session GET "/api/products/ar-blank-account").stock
Write-Host "  库存 锁定后=$before 取消后=$after (应 +1)"

Write-Host "`n[14] 账号合并：TG 用户绑定已有邮箱"
# Widget 签名需要真实 bot token，这里直接在 DB 构造一个 TG 用户并签发 session 模拟
$tgUserId = "tguser$stamp"
Sql "INSERT INTO users (id, role, balance, locale, created_at, updated_at) VALUES ('$tgUserId','USER',0,'zh',NOW(),NOW()); INSERT INTO identities (id, user_id, provider, provider_uid, verified_at, created_at) VALUES ('tgid$stamp','$tgUserId','TELEGRAM','99$stamp',NOW(),NOW());" | Out-Null
$secretLine = Get-Content .env -Encoding UTF8 | Where-Object { $_ -match '^SESSION_SECRET="(.+)"' } | Select-Object -First 1; $secret = if ($secretLine -match '^SESSION_SECRET="(.+)"') { $Matches[1] } else { throw "SESSION_SECRET not found" }
$token = node -e "const {SignJWT}=require('jose');new SignJWT({sub:'$tgUserId'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('$secret')).then(t=>console.log(t))"
$tg = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$tg.Cookies.Add((New-Object System.Net.Cookie("session", $token, "/", "localhost")))
$tgMe = Api $tg GET "/api/me"
Write-Host "  TG 用户 id=$($tgMe.id) identities=$($tgMe.identities.Count)"
Api $tg POST "/api/auth/send-code" @{ email = $userEmail; purpose = "BIND_EMAIL" } | Out-Null
$bcode = LatestCode $userEmail "BIND_EMAIL"
$bind = Api $tg POST "/api/me/bind-email" @{ email = $userEmail; code = $bcode }
Write-Host "  绑定结果: userId=$($bind.userId) merged=$($bind.merged) (应合并到更早的邮箱用户 $($me.userId))"
$tgMe2 = Api $tg GET "/api/me"
Write-Host "  合并后身份: $(($tgMe2.identities | ForEach-Object { $_.provider }) -join ',') (应为 EMAIL,TELEGRAM)"
$tgOrders = Api $tg GET "/api/orders"
Write-Host "  合并后可见订单数: $(@($tgOrders).Count) (应为 3)"

Write-Host "`n[15] 冲突：另一个 TG 用户再绑同一邮箱应被拒绝（预期 409）"
$tgUser2 = "tguserB$stamp"
Sql "INSERT INTO users (id, role, balance, locale, created_at, updated_at) VALUES ('$tgUser2','USER',0,'zh',NOW(),NOW()); INSERT INTO identities (id, user_id, provider, provider_uid, verified_at, created_at) VALUES ('tgidB$stamp','$tgUser2','TELEGRAM','88$stamp',NOW(),NOW());" | Out-Null
$token2 = node -e "const {SignJWT}=require('jose');new SignJWT({sub:'$tgUser2'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('$secret')).then(t=>console.log(t))"
$tg2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$tg2.Cookies.Add((New-Object System.Net.Cookie("session", $token2, "/", "localhost")))
Start-Sleep 1
Sql "UPDATE verification_codes SET created_at = created_at - INTERVAL 2 MINUTE WHERE email='$userEmail';" | Out-Null
Api $tg2 POST "/api/auth/send-code" @{ email = $userEmail; purpose = "BIND_EMAIL" } | Out-Null
$bcode2 = LatestCode $userEmail "BIND_EMAIL"
Api $tg2 POST "/api/me/bind-email" @{ email = $userEmail; code = $bcode2 } | Out-Null

Write-Host "`n完成。"
