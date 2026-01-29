@echo off
chcp 65001 >nul
title Moltbot SSL/TLS Configuration Wizard

set "SERVER=root@38.14.254.51"
set "DOMAIN=38.14.254.51"

echo ========================================
echo   Moltbot SSL/TLS Configuration Wizard
echo ========================================
echo.
echo This wizard will help you configure SSL/TLS encryption
echo for the Moltbot Gateway and monitoring services.
echo.
echo Options:
echo.
echo [1] Use self-signed certificate (free, quick)
echo [2] Use Let's Encrypt (free, requires domain)
echo [3] Use existing certificate
echo [4] Skip SSL configuration
echo.

choice /C 1234 /N /M "Select option (1-4)"
if errorlevel 4 goto end
if errorlevel 3 goto existing_cert
if errorlevel 2 goto letsencrypt
if errorlevel 1 goto self_signed

:self_signed
echo.
echo ========================================
echo   Generating Self-Signed Certificate
echo ========================================
echo.

ssh %SERVER% "mkdir -p /opt/moltbot-ssl && cd /opt/moltbot-ssl && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout moltbot.key -out moltbot.crt -subj '/C=CN/ST=State/L=City/O=Moltbot/CN=%DOMAIN%'"

if errorlevel 1 (
    echo ERROR: Failed to generate certificate
    pause
    goto end
)

echo.
echo Certificate generated successfully!
echo.
echo Configuring services to use SSL...

goto configure_services

:letsencrypt
echo.
echo ========================================
echo   Let's Encrypt Certificate
echo ========================================
echo.
echo To use Let's Encrypt, you need:
echo 1. A domain name pointing to %SERVER%
echo 2. Port 80 open for HTTP verification
echo.
set /p DOMAIN="Enter your domain name: "

if "%DOMAIN%"=="" (
    echo ERROR: Domain name is required
    pause
    goto end
)

echo.
echo Installing certbot...
ssh %SERVER% "apt-get install -y certbot"

echo.
echo Obtaining certificate...
ssh %SERVER% "certbot certonly --standalone -d %DOMAIN% --email admin@%DOMAIN% --agree-tos --non-interactive"

if errorlevel 1 (
    echo ERROR: Failed to obtain certificate
    pause
    goto end
)

echo.
echo Certificate obtained successfully!
echo.
echo Copying certificate to Moltbot directory...
ssh %SERVER% "mkdir -p /opt/moltbot-ssl && cp /etc/letsencrypt/live/%DOMAIN%/fullchain.pem /opt/moltbot-ssl/moltbot.crt && cp /etc/letsencrypt/live/%DOMAIN%/privkey.pem /opt/moltbot-ssl/moltbot.key"

goto configure_services

:existing_cert
echo.
echo ========================================
echo   Using Existing Certificate
echo ========================================
echo.
echo Please provide the paths to your certificate files.
echo.
set /p CERT_PATH="Certificate file (.crt or .pem): "
set /p KEY_PATH="Private key file (.key): "

if "%CERT_PATH%"=="" goto end
if "%KEY_PATH%"=="" goto end

echo.
echo Copying certificate to server...
scp "%CERT_PATH%" %SERVER%:/opt/moltbot-ssl/moltbot.crt
scp "%KEY_PATH%" %SERVER%:/opt/moltbot-ssl/moltbot.key

goto configure_services

:configure_services
echo.
echo ========================================
echo   Configuring Services
echo ========================================
echo.

echo Setting up SSL for Gateway...
ssh %SERVER% "cat > /etc/nginx/sites-available/moltbot-gateway << 'NGINX'
server {
    listen 80;
    server_name %DOMAIN%;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name %DOMAIN%;

    ssl_certificate /opt/moltbot-ssl/moltbot.crt;
    ssl_certificate_key /opt/moltbot-ssl/moltbot.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
"

echo Installing and configuring Nginx...
ssh %SERVER% "apt-get install -y nginx && ln -sf /etc/nginx/sites-available/moltbot-gateway /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"

echo.
echo Configuring Grafana for SSL...
ssh %SERVER% "docker run --rm -v moltbot-monitoring_grafana-data:/data busybox sh -c 'echo \"\\n[server]\\n  protocol = https\\n  cert_file = /etc/grafana/grafana.crt\\n  cert_key = /etc/grafana/grafana.key\" >> /data/grafana.ini'"

echo Copying SSL certificate for Grafana...
ssh %SERVER% "docker cp /opt/moltbot-ssl/moltbot.crt moltbot-grafana:/etc/grafana/grafana.crt && docker cp /opt/moltbot-ssl/moltbot.key moltbot-grafana:/etc/grafana/grafana.key && docker restart moltbot-grafana"

echo.
echo ========================================
echo   SSL Configuration Complete!
echo ========================================
echo.
echo Your services are now accessible via HTTPS:
echo.
echo Gateway:    wss://%DOMAIN%/
echo Grafana:    https://%DOMAIN%:3000
echo Prometheus: https://%DOMAIN%:9090
echo.
echo Note: If using self-signed certificate, you will see
echo a browser warning. This is normal and safe to ignore.
echo.

:end
pause
