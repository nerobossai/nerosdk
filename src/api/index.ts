import express from 'express';

import bot from './bot';

const router = express.Router();

router.use('/bot', bot);

export default router;
