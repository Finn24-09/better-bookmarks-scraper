# PowerShell Test Commands for Screenshot API
# Testing with google.com as target URL

Write-Host "=== Screenshot API Test Commands ===" -ForegroundColor Green
Write-Host ""

# Configuration
$baseUrl = "http://localhost:8080"
$apiKey = "dev-test-key-123"
$targetUrl = "https://www.youtube.com/watch?v=2Qmy4ckRxwo"

Write-Host "API Base URL: $baseUrl" -ForegroundColor Yellow
Write-Host "API Key: $apiKey" -ForegroundColor Yellow
Write-Host "Target URL: $targetUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: Simple GET request with API key in header
Write-Host "=== Test 1: GET request with API key in header ===" -ForegroundColor Cyan
$headers = @{
    "X-API-Key" = $apiKey
}
$getUrl = "$baseUrl/api/v1/screenshot?url=$targetUrl"

Write-Host "Command:" -ForegroundColor White
Write-Host "Invoke-RestMethod -Uri '$getUrl' -Method GET -Headers @{'X-API-Key'='$apiKey'} -OutFile 'test-screenshot-get.png'" -ForegroundColor Gray
Write-Host ""

try {
    Invoke-RestMethod -Uri $getUrl -Method GET -Headers $headers -OutFile "test-screenshot-get.png"
    Write-Host "✅ GET request successful! Screenshot saved as 'test-screenshot-get.png'" -ForegroundColor Green
}
catch {
    Write-Host "❌ GET request failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: POST request with JSON body
Write-Host "=== Test 2: POST request with JSON body ===" -ForegroundColor Cyan
$postUrl = "$baseUrl/api/v1/screenshot"
$body = @{
    url                   = $targetUrl
    detectVideoThumbnails = $true
    width                 = 1920
    height                = 1080
    format                = "png"
    fullPage              = $false
    handleBanners         = $true
} | ConvertTo-Json

$postHeaders = @{
    "X-API-Key"    = $apiKey
    "Content-Type" = "application/json"
}

Write-Host "Command:" -ForegroundColor White
Write-Host "Invoke-RestMethod -Uri '$postUrl' -Method POST -Headers @{'X-API-Key'='$apiKey'; 'Content-Type'='application/json'} -Body '`$(`$body -replace `"`n`", `"`")' -OutFile 'test-screenshot-post.png'" -ForegroundColor Gray
Write-Host ""

try {
    Invoke-RestMethod -Uri $postUrl -Method POST -Headers $postHeaders -Body $body -OutFile "test-screenshot-post.png"
    Write-Host "✅ POST request successful! Screenshot saved as 'test-screenshot-post.png'" -ForegroundColor Green
}
catch {
    Write-Host "❌ POST request failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Advanced POST request with custom options
Write-Host "=== Test 3: Advanced POST request with custom options ===" -ForegroundColor Cyan
$advancedBody = @{
    url           = $targetUrl
    width         = 1366
    height        = 768
    format        = "jpeg"
    quality       = 90
    fullPage      = $true
    timeout       = 30000
    waitUntil     = "networkidle0"
    handleBanners = $true
    bannerTimeout = 5000
} | ConvertTo-Json

Write-Host "Command:" -ForegroundColor White
Write-Host "Invoke-RestMethod -Uri '$postUrl' -Method POST -Headers @{'X-API-Key'='$apiKey'; 'Content-Type'='application/json'} -Body '`$(`$advancedBody -replace `"`n`", `"`")' -OutFile 'test-screenshot-advanced.jpg'" -ForegroundColor Gray
Write-Host ""

try {
    Invoke-RestMethod -Uri $postUrl -Method POST -Headers $postHeaders -Body $advancedBody -OutFile "test-screenshot-advanced.jpg"
    Write-Host "✅ Advanced POST request successful! Screenshot saved as 'test-screenshot-advanced.jpg'" -ForegroundColor Green
}
catch {
    Write-Host "❌ Advanced POST request failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Health check
Write-Host "=== Test 4: Health check ===" -ForegroundColor Cyan
$healthUrl = "$baseUrl/health"

Write-Host "Command:" -ForegroundColor White
Write-Host "Invoke-RestMethod -Uri '$healthUrl' -Method GET" -ForegroundColor Gray
Write-Host ""

try {
    $healthResponse = Invoke-RestMethod -Uri $healthUrl -Method GET
    Write-Host "✅ Health check successful!" -ForegroundColor Green
    Write-Host "Response: $($healthResponse | ConvertTo-Json -Compress)" -ForegroundColor White
}
catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== Test Summary ===" -ForegroundColor Green
Write-Host "All test commands completed. Check the generated screenshot files:" -ForegroundColor White
Write-Host "- test-screenshot-get.png (GET with header)" -ForegroundColor Gray
Write-Host "- test-screenshot-query.png (GET with query param)" -ForegroundColor Gray
Write-Host "- test-screenshot-post.png (POST basic)" -ForegroundColor Gray
Write-Host "- test-screenshot-advanced.jpg (POST advanced)" -ForegroundColor Gray
