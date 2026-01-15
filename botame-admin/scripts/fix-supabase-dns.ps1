# PowerShell script to get Supabase IP and add to WSL /etc/hosts
# Run this in Windows PowerShell (Administrator)

Write-Host "Getting Supabase IP address..."
$ip = (Resolve-DnsName -Name "oagcozlzpfedjnetpjus.supabase.co" -Type A | Select-Object -First 1).IPAddress
Write-Host "Supabase IP: $ip"

Write-Host "`nAdd this line to WSL /etc/hosts:"
Write-Host "$ip oagcozlzpfedjnetpjus.supabase.co"

Write-Host "`nTo add it automatically, run in WSL:"
Write-Host "echo '$ip oagcozlzpfedjnetpjus.supabase.co' | sudo tee -a /etc/hosts"
