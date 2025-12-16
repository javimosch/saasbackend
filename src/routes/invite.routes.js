const express = require('express');
const router = express.Router();
const inviteController = require('../controllers/invite.controller');

router.get('/info', inviteController.getInviteInfo);
router.post('/accept', inviteController.acceptInvite);

module.exports = router;
