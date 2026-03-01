@echo off
REM Script para criar usuário usando Better Auth API (Windows)
REM Uso: create-user.bat <email> <senha> [nome]

if "%~2"=="" (
    echo Uso: %~nx0 ^<email^> ^<senha^> [nome]
    echo Exemplo: %~nx0 admin@example.com senha123 "Admin User"
    exit /b 1
)

set EMAIL=%~1
set PASSWORD=%~2
set NAME=%~3

if "%NAME%"=="" set NAME=

REM Carregar variáveis de ambiente do arquivo .env se existir
if exist .env (
    for /f "tokens=1,* delims==" %%a in (.env) do (
        if not "%%a"=="" if not "%%a"=="#" (
            set "%%a=%%b"
        )
    )
)

REM Configurar URL da API
if "%BETTER_AUTH_URL%"=="" set BETTER_AUTH_URL=http://localhost:3000
set BASE_PATH=/api/auth

echo Criando usuário via Better Auth...
echo Email: %EMAIL%
echo Nome: %NAME%
echo API: %BETTER_AUTH_URL%%BASE_PATH%/sign-up/email

REM Criar arquivo JSON temporário
(
echo {
echo   "email": "%EMAIL%",
echo   "password": "%PASSWORD%",
echo   "name": "%NAME%"
echo }
) > "%TEMP%\create-user-payload.json"

REM Fazer requisição para Better Auth usando PowerShell
powershell -Command "$response = Invoke-RestMethod -Uri '%BETTER_AUTH_URL%%BASE_PATH%/sign-up/email' -Method Post -ContentType 'application/json' -Body (Get-Content '%TEMP%\create-user-payload.json' -Raw); Write-Host '✅ Usuário criado com sucesso!'; $response | ConvertTo-Json"

if errorlevel 1 (
    echo ❌ Erro ao criar usuário
    del "%TEMP%\create-user-payload.json"
    exit /b 1
)

del "%TEMP%\create-user-payload.json"
