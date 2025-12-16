const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { loadOrgContext, requireOrgMember, requireOrgRoleAtLeast, requireOrgRole } = require('../middleware/org');
const orgController = require('../controllers/org.controller');
const inviteController = require('../controllers/invite.controller');

router.get('/', authenticate, orgController.listOrgs);
router.post('/', authenticate, orgController.createOrg);

router.get('/:orgId/public', orgController.getOrgPublic);

router.get('/:orgId', authenticate, loadOrgContext, requireOrgMember, orgController.getOrg);
router.put('/:orgId', authenticate, loadOrgContext, requireOrgRoleAtLeast('admin'), orgController.updateOrg);
router.delete('/:orgId', authenticate, loadOrgContext, requireOrgRole('owner'), orgController.deleteOrg);

router.post('/:orgId/join', authenticate, loadOrgContext, orgController.joinOrg);

router.get('/:orgId/members', authenticate, loadOrgContext, requireOrgMember, orgController.listMembers);
router.post('/:orgId/members', authenticate, loadOrgContext, requireOrgRoleAtLeast('admin'), orgController.addMember);
router.put('/:orgId/members/:userId/role', authenticate, loadOrgContext, requireOrgRoleAtLeast('admin'), orgController.updateMemberRole);
router.delete('/:orgId/members/:userId', authenticate, loadOrgContext, requireOrgRoleAtLeast('admin'), orgController.removeMember);

router.get('/:orgId/invites', authenticate, loadOrgContext, requireOrgRoleAtLeast('admin'), inviteController.listInvites);
router.post('/:orgId/invites', authenticate, loadOrgContext, requireOrgRoleAtLeast('admin'), inviteController.createInvite);
router.delete('/:orgId/invites/:inviteId', authenticate, loadOrgContext, requireOrgRoleAtLeast('admin'), inviteController.revokeInvite);

module.exports = router;
