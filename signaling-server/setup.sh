#!/bin/bash
set -e

echo "Enabling Node.js 20 module..."
sudo dnf module enable nodejs:20 -y

echo "Installing Node.js and Git..."
sudo dnf install -y nodejs git

echo "Installing PM2 globally..."
sudo npm install -g pm2

echo "Cloning repository..."
rm -rf co-viewer
git clone https://github.com/Ved-Dixit/co-viewer.git

cd co-viewer/signaling-server

echo "Creating .env file..."
cat << 'EOF' > .env
DB_USER=admin
DB_PASSWORD=Pratham@1234
DB_CONNECTION_STRING="(description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1521)(host=adb.ap-mumbai-1.oraclecloud.com))(connect_data=(service_name=g76f05c609d545b_scl1uymcucyhv0yv_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))"
PORT=8080
EOF

echo "Installing NPM dependencies..."
npm install

echo "Opening Firewall port 8080..."
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload

echo "Starting server with PM2..."
pm2 start server.js --name coviewer
pm2 save

echo "Setting up PM2 startup script..."
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u opc --hp /home/opc

echo "Setup Complete!"
