const oracledb = require('oracledb');
require('dotenv').config();

// Configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECTION_STRING
};

// oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function initialize() {
  try {
    await oracledb.createPool(dbConfig);
    console.log('Oracle Database connection pool created');
  } catch (err) {
    console.error('Database connection pool creation failed:', err);
  }
}

async function close() {
  try {
    await oracledb.getPool().close(10);
    console.log('Database pool closed');
  } catch (err) {
    console.error(err);
  }
}

async function saveSession(code, role) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `INSERT INTO SESSIONS (CODE, ROLE) VALUES (:code, :role)`,
      [code, role],
      { autoCommit: true }
    );
    console.log(`Session ${code} saved to DB`);
  } catch (err) {
    console.error('Error saving session:', err);
  } finally {
    if (connection) await connection.close();
  }
}

async function saveMessage(code, from, text, type = 'text') {
  let connection;
  try {
    connection = await oracledb.getConnection();
    await connection.execute(
      `INSERT INTO CHAT_MESSAGES (SESSION_CODE, SENDER_ROLE, MESSAGE_TEXT, MESSAGE_TYPE) 
       VALUES (:code, :from, :text, :type)`,
      { code, from, text, type },
      { autoCommit: true }
    );
  } catch (err) {
    console.error('Error saving message:', err);
  } finally {
    if (connection) await connection.close();
  }
}

async function getSessionMessages(code) {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      `SELECT SENDER_ROLE, MESSAGE_TEXT, MESSAGE_TYPE, CREATED_AT 
       FROM CHAT_MESSAGES 
       WHERE SESSION_CODE = :code 
       ORDER BY CREATED_AT ASC`,
      [code],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows;
  } catch (err) {
    console.error('Error fetching messages:', err);
    return [];
  } finally {
    if (connection) await connection.close();
  }
}

module.exports = {
  initialize,
  close,
  saveSession,
  saveMessage,
  getSessionMessages
};
