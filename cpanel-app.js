require('dotenv').config();

process.env.CPANEL_ENV = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || process.env.APP_PORT || '3000';

require('./server');
