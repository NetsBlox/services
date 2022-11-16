const utils = require('../assets/utils');

describe(utils.suiteName(__filename), function() {
    const assert = require('assert');
    const PublicRoles = utils.reqSrc('procedures/public-roles/public-roles');
    const RPCMock = require('../assets/mock-service');


    utils.verifyRPCInterfaces('PublicRoles', [
        ['getPublicRoleId'],
        ['requestPublicRoleId'],
    ]);

    describe('getPublicRoleId', function() {
        let publicroles;
        before(async () => {
            publicroles = new RPCMock(PublicRoles);
            await utils.reset();
        });
        after(() => publicroles.destroy());

        // TODO: update this to the new version
        it.skip('should return the public role ID of the socket', async function() {
            const Projects = utils.reqSrc('storage/projects');
            const project = await Projects.get('brian', 'MultiRoles');
            publicroles.socket.projectId = project.getId();
            publicroles.socket.roleId = await project.getRoleId('r1');
            const id = await publicroles.getPublicRoleId();
            assert.equal(id, 'r1@MultiRoles@brian');
        });
    });
});
