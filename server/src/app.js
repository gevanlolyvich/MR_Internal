const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const authRoutes = require('./modules/auth/auth.route');
const userRoutes = require('./modules/users/user.route');
const branchRoutes = require('./modules/branches/branch.route');
const masterRoutes = require('./modules/masters/master.route');
const riskRegisterRoutes = require('./modules/risk-registers/riskRegister.route');
const approvalRoutes = require('./modules/approvals/approval.route');
const dashboardRoutes = require('./modules/dashboard/dashboard.route');
const matrixRoutes = require('./modules/matrix/matrix.route');
const monitoringRoutes = require('./modules/monitoring/monitoring.route');
const exportRoutes = require('./modules/export/export.route');
const notificationRoutes = require('./modules/notifications/notification.route');
const auditRoutes = require('./modules/audit/audit.route');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/masters', masterRoutes);
app.use('/api/risk-registers', riskRegisterRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/matrix', matrixRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
