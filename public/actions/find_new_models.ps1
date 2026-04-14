# Sketchfab search + report for anime characters and props
$results = @()

$queries = @(
    @{q="anime girl character"; cat="characters-creatures"; label="CHAR"},
    @{q="anime school uniform girl"; cat="characters-creatures"; label="CHAR"},
    @{q="anime cyberpunk girl"; cat="characters-creatures"; label="CHAR"},
    @{q="japanese lantern prop"; cat=""; label="PROP"},
    @{q="neon sign japanese"; cat=""; label="PROP"}
)

foreach ($qObj in $queries) {
    $q = $qObj.q
    $label = $qObj.label
    $url = "https://api.sketchfab.com/v3/models?q=" + [Uri]::EscapeDataString($q) + "&downloadable=true&count=6&sort_by=-likeCount"
    if ($qObj.cat -ne "") { $url += "&categories=" + $qObj.cat }
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
        $data = $resp.Content | ConvertFrom-Json
        foreach ($m in $data.results) {
            $results += "[$label] $($m.uid) | $($m.name.Substring(0, [Math]::Min(55,$m.name.Length))) | likes=$($m.likeCount) | verts=$($m.vertexCount)"
        }
    } catch {
        $results += "[ERR] $q : $_"
    }
    Start-Sleep -Milliseconds 500
}

$out = "C:\Users\Aiden\Desktop\model_search.txt"
$results | Set-Content $out
Write-Output "SEARCH_DONE results=$($results.Count) file=$out"
foreach ($r in $results) { Write-Output $r }
