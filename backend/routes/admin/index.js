const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { adminLimiter } = require('../../middleware/rateLimit');

const statsRoutes = require('./stats');
const usersRoutes = require('./users');
const escalationsRoutes = require('./escalations');
const documentsRoutes = require('./documents');
const kbRoutes = require('./kb');
const settingsRoutes = require('./settings');

router.use(requireAuth, requireAdmin, adminLimiter);

router.use('/', statsRoutes);
router.use('/', usersRoutes);
router.use('/', escalationsRoutes);
router.use('/', documentsRoutes);
router.use('/', kbRoutes);
router.use('/', settingsRoutes);

module.exports = router;
