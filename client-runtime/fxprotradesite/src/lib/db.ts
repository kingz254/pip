import mysql from 'mysql2/promise';

// Create a connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'trading_app',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Initialize database tables on startup
async function initTables() {
    try {
        console.log('Initializing database tables...');

        // Create strategy_providers table if it doesn't exist
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS strategy_providers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        login_id VARCHAR(255) NOT NULL,
        min_balance DECIMAL(10,2) DEFAULT 50.00,
        win_rate DECIMAL(5,2) DEFAULT 0,
        profit_percentage DECIMAL(5,2) DEFAULT 0,
        total_trades INT DEFAULT 0,
        application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        is_active BOOLEAN DEFAULT 1,
        profile_picture LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_login_id (login_id),
        INDEX idx_status (status)
      )
    `);

        // Check if profile_picture column exists, if not add it
        await pool
            .execute(
                `
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'strategy_providers' 
      AND COLUMN_NAME = 'profile_picture'
    `
            )
            .then(async ([rows]: any) => {
                if (rows[0].count === 0) {
                    console.log('Adding profile_picture column to strategy_providers table');
                    await pool.execute(`
          ALTER TABLE strategy_providers 
          ADD COLUMN profile_picture LONGTEXT AFTER is_active
        `);
                }
            });

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database tables:', error);
    }
}

// Export the pool and initialization function
export { pool, initTables };
