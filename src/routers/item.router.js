'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/item.controller');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');

const router = Router();

/**
 * @swagger
 * /api/items:
 *   get:
 *     tags: [Items]
 *     summary: Harytlaryň sanawy (açyk — token gerek däl)
 *     security: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Ady, PLU ýa-da barkod boýunça gözleg
 *     responses:
 *       200:
 *         description: Harytlar sanawy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Item' }
 *   post:
 *     tags: [Items]
 *     summary: Täze haryt goş (diňe admin) — barkod PLU-dan awtomatiki döreýär
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ItemInput'
 *     responses:
 *       201:
 *         description: Haryt döredildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Item' }
 *       409:
 *         description: Bu PLU eýýäm bar
 */
router.get('/', ctrl.list);
router.get('/lookup', ctrl.lookup);
router.get('/next-code', ctrl.nextCode);

/**
 * @swagger
 * /api/items/import:
 *   post:
 *     tags: [Items]
 *     summary: CSV/Excel satyrlaryny import et (diňe admin, PLU boýunça upsert)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rows:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/ItemInput' }
 *     responses:
 *       200:
 *         description: Import netijesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     added: { type: integer, example: 5 }
 *                     updated: { type: integer, example: 2 }
 */
router.post('/import', authenticate, requireAdmin, ctrl.bulkImport);

router.post('/', authenticate, requireAdmin, ctrl.create);

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     tags: [Items]
 *     summary: Bir haryt (açyk)
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Haryt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Item' }
 *       404:
 *         description: Haryt tapylmady
 *   put:
 *     tags: [Items]
 *     summary: Harydy üýtget (diňe admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ItemInput'
 *     responses:
 *       200:
 *         description: Üýtgedildi
 *       404:
 *         description: Haryt tapylmady
 *   delete:
 *     tags: [Items]
 *     summary: Harydy poz (diňe admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pozuldy
 *       404:
 *         description: Haryt tapylmady
 */
router.get('/:id', ctrl.getById);
router.put('/:id', authenticate, requireAdmin, ctrl.update);
router.delete('/:id', authenticate, requireAdmin, ctrl.remove);

module.exports = router;
