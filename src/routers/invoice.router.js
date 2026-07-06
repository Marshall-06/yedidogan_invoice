'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/invoice.controller');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');

const router = Router();

/* Ähli /api/invoices marşrutlary — token + admin gerek */
router.use(authenticate, requireAdmin);

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     tags: [Invoices]
 *     summary: Fakturalaryň sanawy (diňe admin)
 *     responses:
 *       200:
 *         description: Fakturalar sanawy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Invoice' }
 *   post:
 *     tags: [Invoices]
 *     summary: Täze faktura ýatda sakla (diňe admin) — net awtomatiki hasaplanýar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InvoiceInput'
 *     responses:
 *       201:
 *         description: Faktura döredildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Invoice' }
 *       400:
 *         description: Iň bolmanda bir setir bolmaly
 */
router.get('/', ctrl.list);
router.post('/', ctrl.create);

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     tags: [Invoices]
 *     summary: Bir faktura (setirler bilen)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Faktura
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Invoice' }
 *       404:
 *         description: Faktura tapylmady
 *   put:
 *     tags: [Invoices]
 *     summary: Fakturany üýtget (diňe admin)
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
 *             $ref: '#/components/schemas/InvoiceInput'
 *     responses:
 *       200:
 *         description: Faktura täzelendi
 *       404:
 *         description: Faktura tapylmady
 *   delete:
 *     tags: [Invoices]
 *     summary: Faktura poz (diňe admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pozuldy
 *       404:
 *         description: Faktura tapylmady
 */
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
