require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { startScheduledJobs } = require('./jobs/scheduler');

const voterRoutes = require('./routes/voterRoutes');
const adminRoutes = require('./routes/adminRoutes');
const electionRoutes = require('./routes/electionRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();
connectDB();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/voters', voterRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/public', publicRoutes);

// Central error handler. Route handlers are wrapped (utils/asyncHandler), so
// errors thrown inside async controllers — and multer upload errors — land here.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = err.status || 500;
  let message = err.message || 'Server error.';

  if (err.name === 'CastError') {
    status = 400; message = 'Invalid ID.';
  } else if (err.name === 'ValidationError') {
    status = 400; message = Object.values(err.errors).map((e) => e.message).join(' ');
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    status = 409; message = field ? `That ${field} is already in use.` : 'That value is already in use.';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    status = 400; message = 'File too large — each upload must be under 200KB.';
  }

  if (status >= 500) {
    console.error(err);
    if (process.env.NODE_ENV === 'production') message = 'Server error.';
  }
  res.status(status).json({ message });
});

// Safety net: log a stray rejected promise rather than letting it kill the server.
process.on('unhandledRejection', (reason) => console.error('[UNHANDLED REJECTION]', reason));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startScheduledJobs();
});
