#!/bin/bash
set -e

echo "1/7 Downloading Node.js 20..."
wget -q https://nodejs.org/dist/v20.12.2/node-v20.12.2-linux-x64.tar.xz -O node.tar.xz
tar -xf node.tar.xz
sudo cp -R node-v20.12.2-linux-x64/* /usr/local/
rm -rf node.tar.xz node-v20.12.2-linux-x64

echo "2/7 Installing PM2 globally..."
sudo env PATH=$PATH:/usr/local/bin /usr/local/bin/npm install -g pm2

echo "3/7 Downloading Co-Viewer Repository..."
rm -rf co-viewer co-viewer-main repo.tar.gz
wget -q https://github.com/Ved-Dixit/co-viewer/archive/refs/heads/main.tar.gz -O repo.tar.gz
tar -xf repo.tar.gz
mv co-viewer-main co-viewer
rm repo.tar.gz

cd co-viewer/signaling-server

echo "4/7 Creating .env file..."
cat << 'EOF' > .env
DB_USER=admin
DB_PASSWORD=Pratham@1234
DB_CONNECTION_STRING="(description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1521)(host=adb.ap-mumbai-1.oraclecloud.com))(connect_data=(service_name=g76f05c609d545b_scl1uymcucyhv0yv_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))"
PORT=8080
EOF

echo "5/7 Installing NPM Dependencies..."
/usr/local/bin/npm install

echo "6/7 Opening Firewall port 8080..."
sudo firewall-cmd --permanent --add-port=8080/tcp || true
sudo firewall-cmd --reload || true

echo "7/7 Starting Server..."
/usr/local/bin/pm2 start server.js --name coviewer
/usr/local/bin/pm2 save

sudo env PATH=$PATH:/usr/local/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u opc --hp /home/opc

echo "DONE! SERVER IS LIVE!"
