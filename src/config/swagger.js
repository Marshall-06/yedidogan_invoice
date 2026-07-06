'use strict';

const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const config = require('./index');

/* ══════════════════════════════════════════════════════
   SWAGGER / OpenAPI 3 konfigurasiýasy
   Marşrut faýllaryndaky @swagger JSDoc kommentleri okalýar.
══════════════════════════════════════════════════════ */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Label Zawod API',
      version: '1.0.0',
      description:
        'Ammar sistemasy — harytlar bazasy, fakturalar we ulanyjy dolandyryş.\n\n' +
        'Awtorizasiýa: ilki `/api/auth/register` (ilkinji ulanyjy admin bolýar) ' +
        'ýa-da `/api/auth/login` arkaly token al, soň ýokarky **Authorize** ' +
        'düwmesine basyp `Bearer <token>` gir.',
    },
    servers: [
      { url: `http://localhost:${config.port}`, description: 'Lokal serwer' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Ýalňyşlyk habary' },
            details: { type: 'array', items: { type: 'string' } },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' },
                user: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            email: { type: 'string', example: 'admin@label.tm' },
            name: { type: 'string', example: 'Admin' },
            role: { type: 'string', enum: ['admin', 'user'], example: 'admin' },
          },
        },
        UserInput: {
          type: 'object',
          required: ['email', 'code'],
          properties: {
            email: { type: 'string', example: 'ulanyjy@label.tm' },
            name: { type: 'string', example: 'Işgär' },
            code: { type: 'string', example: '1234', description: 'Giriş koduny (parol)' },
            role: { type: 'string', enum: ['admin', 'user'], example: 'user' },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'code'],
          properties: {
            email: { type: 'string', example: 'admin@label.tm' },
            code: { type: 'string', example: '1234' },
          },
        },
        Item: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            plu: { type: 'string', example: '21025' },
            name: { type: 'string', example: 'Duýgy_Direg zefir 17gr' },
            gram: { type: 'integer', example: 214 },
            mm: { type: 'integer', example: 140 },
            code: { type: 'string', example: 'S22' },
            tare: { type: 'string', example: '30' },
            barcode: { type: 'string', example: '0002102502142' },
            mode: { type: 'string', example: 'Ters' },
            self: { type: 'string', example: '' },
            label: { type: 'string', example: '' },
            shop: { type: 'string', example: '' },
          },
        },
        ItemInput: {
          type: 'object',
          required: ['name', 'code'],
          properties: {
            plu: { type: 'string', example: '21025' },
            name: { type: 'string', example: 'Duýgy_Direg zefir 17gr' },
            gram: { type: 'integer', example: 214 },
            mm: { type: 'integer', example: 140 },
            code: { type: 'string', example: 'S22' },
            tare: { type: 'number', example: 30 },
            mode: { type: 'string', example: 'Ters' },
            self: { type: 'string', example: '' },
            label: { type: 'string', example: '' },
            shop: { type: 'string', example: '' },
          },
        },
        InvoiceItemInput: {
          type: 'object',
          properties: {
            plu: { type: 'string', example: '21025' },
            name: { type: 'string', example: 'Duýgy_Direg zefir' },
            code: { type: 'string', example: 'S22' },
            width: { type: 'string', example: '140' },
            mode: { type: 'string', example: 'Ters' },
            gross: { type: 'number', example: 1250 },
            tare: { type: 'number', example: 30 },
            self: { type: 'string', example: '' },
            label: { type: 'string', example: '' },
            shop: { type: 'string', example: '' },
            boxQty: { type: 'integer', example: 2 },
          },
        },
        InvoiceInput: {
          type: 'object',
          required: ['items'],
          properties: {
            fakturaNo: { type: 'string', example: '721' },
            zawod: { type: 'string', example: 'Label Zawody' },
            sklad: { type: 'string', example: 'Sklad №3' },
            date: { type: 'string', format: 'date', example: '2026-06-22' },
            issued: { type: 'string', example: 'Işgäriň ady' },
            received: { type: 'string', example: 'Alyjynyň ady' },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/InvoiceItemInput' },
            },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            fakturaNo: { type: 'string', example: '721' },
            zawod: { type: 'string' },
            sklad: { type: 'string' },
            date: { type: 'string', format: 'date' },
            issued: { type: 'string' },
            received: { type: 'string' },
            items: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Registrasiýa / Giriş' },
      { name: 'Users', description: 'Ulanyjy dolandyryş (admin)' },
      { name: 'Items', description: 'Harytlar bazasy' },
      { name: 'Invoices', description: 'Fakturalar (admin)' },
    ],
  },
  // ÜNS: glob öňe-slash (/) talap edýär — Windows ters-slashlaryny çalyşýarys
  apis: [path.join(__dirname, '../routers/*.js').replace(/\\/g, '/')],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
