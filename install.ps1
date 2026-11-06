# Installs the same released code as install.sh, using native Windows tools.
$ErrorActionPreference = 'Stop'
$installArgs = @($args)
$published = 'https://github.com/Jimmy-Prime/agent-autoloop.git'
$upstream = 'https://github.com/KKKKhazix/agent-autoloop.git'
$repository = if ($env:AGENT_AUTOLOOP_REPO) { $env:AGENT_AUTOLOOP_REPO } else { $published }
# A new install speaks Windows' display language; one already installed speaks what its rules.json says. It's said in the
# environment, which a release older than this script doesn't refuse, as it would an unknown flag.
if (-not $env:AGENT_AUTOLOOP_LANGUAGE) {
    $culture = (Get-UICulture).Name
    $env:AGENT_AUTOLOOP_LANGUAGE = if ($culture -match '^zh-(TW|HK|MO|Hant)') { 'zh-TW' } elseif ($culture -match '^zh') { 'zh-CN' } else { 'en' }
}
# What this script says, in that language: Simplified Chinese, Traditional Chinese, English.
function Say($zhCN, $zhTW, $en) {
    switch ($env:AGENT_AUTOLOOP_LANGUAGE) { 'zh-TW' { $zhTW } 'en' { $en } default { $zhCN } }
}
$installRoot = if ($env:AGENT_AUTOLOOP_HOME) { [IO.Path]::GetFullPath($env:AGENT_AUTOLOOP_HOME) } else { Join-Path $env:USERPROFILE '.agent-autoloop' }
$app = Join-Path $installRoot 'app'
$program = Join-Path $app 'bin\agent-autoloop.ts'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$git = (Get-Command git.exe -ErrorAction Stop).Source
$nodeVersion = & $node -p process.versions.node
if ($LASTEXITCODE -ne 0 -or [int]$nodeVersion.Split('.')[0] -lt 24) { throw (Say '需要 Node.js 24 或更新，装好后再运行安装命令。' '需要 Node.js 24 或更新，裝好後再執行安裝命令。' 'Node.js 24 or newer is needed. Install it, then run the install command again.') }

function Invoke-RepoGit {
    & $git @args
    if ($LASTEXITCODE -ne 0) { throw (Say "Git 没成功：$($args[0])" "Git 沒成功：$($args[0])" "Git failed: $($args[0])") }
}

[IO.Directory]::CreateDirectory($installRoot) | Out-Null
$from = $repository
if (Test-Path (Join-Path $app '.git')) {
    $from = Invoke-RepoGit -C $app config --get remote.origin.url
    # Running this fork's installer over upstream's published copy is asking for the fork. Left on upstream's origin, a
    # release's detached HEAD has nothing to pull, and the install would fail.
    if ($from -eq $upstream -and $repository -eq $published) {
        Invoke-RepoGit -C $app remote set-url origin $published
        $from = $published
        Write-Host (Say '原来跟着上游 KKKKhazix/agent-autoloop，现在改成跟着这个 fork 的 Release。' '原本跟著上游 KKKKhazix/agent-autoloop，現在改成跟著這個 fork 的 Release。' "This followed upstream KKKKhazix/agent-autoloop; it now follows this fork's releases.")
    }
}
$release = $null
if ($from -eq $published) {
    $tags = Invoke-RepoGit ls-remote --refs --tags $published 'v*'
    $versions = @($tags | ForEach-Object { if ($_ -match 'refs/tags/(v\d+\.\d+\.\d+)$') { $Matches[1] } } | Sort-Object { [version]$_.Substring(1) })
    if ($versions.Count) { $release = $versions[-1] }
}
if (!(Test-Path (Join-Path $app '.git'))) {
    $clone = @('-c', 'core.autocrlf=false', '-c', 'advice.detachedHead=false', 'clone', '--quiet', '--depth', '1')
    if ($release) { $clone += @('--branch', $release) }
    Invoke-RepoGit @clone -- $repository $app
} elseif ($release) {
    Invoke-RepoGit -C $app fetch --quiet --depth 1 origin "refs/tags/${release}:refs/tags/${release}"
    Invoke-RepoGit -C $app checkout --quiet --detach $release
} else {
    Invoke-RepoGit -C $app pull --ff-only --quiet
}

$bin = Join-Path $app 'bin'
if (!$env:AGENT_AUTOLOOP_HOME) {
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($bin -notin ($userPath -split ';')) {
        [Environment]::SetEnvironmentVariable('Path', ((([string]$userPath).TrimEnd(';'), $bin) -join ';'), 'User')
    }
    if ($bin -notin ($env:Path -split ';')) { $env:Path += ";$bin" }
}

if ($installArgs.Count -and $installArgs[0] -eq 'join') {
    & $node --disable-warning=ExperimentalWarning $program @installArgs
} elseif (Test-Path (Join-Path $installRoot 'config.json')) {
    Write-Host (Say '更新好了。' '更新好了。' 'Updated.')
    if ('--no-service' -notin $installArgs) { & $node --disable-warning=ExperimentalWarning $program service install }
} else {
    & $node --disable-warning=ExperimentalWarning $program init @installArgs
}
if ($LASTEXITCODE -ne 0) { throw (Say '安装没有完成，请按上面的原因处理。' '安裝沒有完成，請照上面的原因處理。' "The install didn't finish; see the reason above.") }
