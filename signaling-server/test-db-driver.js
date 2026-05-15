const oracledb = require('oracledb');

try {
    console.log('Oracle client version:', oracledb.oracleClientVersionString);
    console.log('Oracledb version:', oracledb.versionString);
    console.log('Success: Oracle driver loaded correctly.');
} catch (err) {
    console.error('Error loading Oracle driver:', err.message);
    console.log('\nTIP: If you see "DPI-1047: Cannot locate a 64-bit Oracle Client library", you need to install Oracle Instant Client.');
}
