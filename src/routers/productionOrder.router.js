'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/productionOrder.controller');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', ctrl.list);
router.get('/meta', ctrl.meta);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
