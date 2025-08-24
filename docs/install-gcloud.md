# Google Cloud SDK Installation for Windows

## Method 1: Direct Download (Recommended)
1. Download: https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe
2. Run installer and follow prompts
3. Restart PowerShell
4. Run: `gcloud init`

## Method 2: Chocolatey
```powershell
# Install Chocolatey first if you don't have it
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Google Cloud SDK
choco install gcloudsdk

# Restart PowerShell
gcloud init
```

## Method 3: Manual Setup (No CLI needed)
Use Google Cloud Console web interface for all setup steps.
