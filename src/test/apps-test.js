/* global it:false */
/* global describe:false */
/* global before:false */
/* global after:false */

'use strict';

var appdb = require('../appdb.js'),
    apps = require('../apps.js'),
    AppsError = apps.AppsError,
    async = require('async'),
    config = require('../config.js'),
    constants = require('../constants.js'),
    database = require('../database.js'),
    expect = require('expect.js'),
    groupdb = require('../groupdb.js'),
    groups = require('../groups.js'),
    hat = require('hat'),
    settings = require('../settings.js'),
    settingsdb = require('../settingsdb.js'),
    userdb = require('../userdb.js');

describe('Apps', function () {
    var ADMIN_0 = {
        id: 'admin123',
        username: 'admin123',
        password: 'secret',
        email: 'admin@me.com',
        salt: 'morton',
        createdAt: 'sometime back',
        modifiedAt: 'now',
        resetToken: hat(256),
        displayName: ''
    };

    var USER_0 = {
        id: 'uuid213',
        username: 'uuid213',
        password: 'secret',
        email: 'safe@me.com',
        salt: 'morton',
        createdAt: 'sometime back',
        modifiedAt: 'now',
        resetToken: hat(256),
        displayName: ''
    };

    var USER_1 = {
        id: 'uuid2134',
        username: 'uuid2134',
        password: 'secret',
        email: 'safe1@me.com',
        salt: 'morton',
        createdAt: 'sometime back',
        modifiedAt: 'now',
        resetToken: hat(256),
        displayName: ''
    };

    var GROUP_0 = {
        id: 'somegroup',
        name: 'group0'
    };
    var GROUP_1 = {
        id: 'anothergroup',
        name: 'group1'
    };

    var APP_0 = {
        id: 'appid-0',
        appStoreId: 'appStoreId-0',
        location: 'some-location-0',
        manifest: {
            version: '0.1', dockerImage: 'docker/app0', healthCheckPath: '/', httpPort: 80, title: 'app0',
            tcpPorts: {
                PORT: {
                    description: 'this is a port that i expose',
                    containerPort: '1234'
                }
            }
        },
        portBindings: { PORT: 5678 },
        accessRestriction: null,
        memoryLimit: 0
    };

    var APP_1 = {
        id: 'appid-1',
        appStoreId: 'appStoreId-1',
        location: 'some-location-1',
        manifest: {
            version: '0.1', dockerImage: 'docker/app1', healthCheckPath: '/', httpPort: 80, title: 'app1',
            tcpPorts: {}
        },
        portBindings: null,
        accessRestriction: { users: [ 'someuser' ], groups: [ GROUP_0.id ] },
        memoryLimit: 0
    };

    var APP_2 = {
        id: 'appid-2',
        appStoreId: 'appStoreId-2',
        location: 'some-location-2',
        manifest: {
            version: '0.1', dockerImage: 'docker/app2', healthCheckPath: '/', httpPort: 80, title: 'app2',
            tcpPorts: {}
        },
        portBindings: null,
        accessRestriction: { users: [ 'someuser', USER_0.id ], groups: [ GROUP_1.id ] },
        memoryLimit: 0
    };

    before(function (done) {

        async.series([
            database.initialize,
            database._clear,
            userdb.add.bind(null, ADMIN_0.id, ADMIN_0),
            userdb.add.bind(null, USER_0.id, USER_0),
            userdb.add.bind(null, USER_1.id, USER_1),
            groupdb.add.bind(null, GROUP_0.id, GROUP_0.name),
            groupdb.add.bind(null, GROUP_1.id, GROUP_1.name),
            groups.addMember.bind(null, constants.ADMIN_GROUP_ID, ADMIN_0.id),
            groups.addMember.bind(null, GROUP_0.id, USER_1.id),
            appdb.add.bind(null, APP_0.id, APP_0.appStoreId, APP_0.manifest, APP_0.location, APP_0.portBindings, APP_0),
            appdb.add.bind(null, APP_1.id, APP_1.appStoreId, APP_1.manifest, APP_1.location, APP_1.portBindings, APP_1),
            appdb.add.bind(null, APP_2.id, APP_2.appStoreId, APP_2.manifest, APP_2.location, APP_2.portBindings, APP_2),
            settingsdb.set.bind(null, settings.BACKUP_CONFIG_KEY, JSON.stringify({ provider: 'caas', token: 'BACKUP_TOKEN', bucket: 'Bucket', prefix: 'Prefix' }))
        ], done);
    });

    after(function (done) {
        database._clear(done);
    });

    describe('validateHostname', function () {
        it('does not allow admin subdomain', function () {
            expect(apps._validateHostname(constants.ADMIN_LOCATION, 'cloudron.us')).to.be.an(Error);
        });

        it('cannot have >63 length subdomains', function () {
            var s = '';
            for (var i = 0; i < 64; i++) s += 's';
            expect(apps._validateHostname(s, 'cloudron.us')).to.be.an(Error);
        });

        it('allows only alphanumerics and hypen', function () {
            expect(apps._validateHostname('#2r', 'cloudron.us')).to.be.an(Error);
            expect(apps._validateHostname('a%b', 'cloudron.us')).to.be.an(Error);
            expect(apps._validateHostname('ab_', 'cloudron.us')).to.be.an(Error);
            expect(apps._validateHostname('a.b', 'cloudron.us')).to.be.an(Error);
            expect(apps._validateHostname('-ab', 'cloudron.us')).to.be.an(Error);
            expect(apps._validateHostname('ab-', 'cloudron.us')).to.be.an(Error);
        });

        it('total length cannot exceed 255', function () {
            var s = '';
            for (var i = 0; i < (255 - 'cloudron.us'.length); i++) s += 's';

            expect(apps._validateHostname(s, 'cloudron.us')).to.be.an(Error);
        });

        it('allow valid domains', function () {
            expect(apps._validateHostname('a', 'cloudron.us')).to.be(null);
            expect(apps._validateHostname('a0-x', 'cloudron.us')).to.be(null);
            expect(apps._validateHostname('01', 'cloudron.us')).to.be(null);
        });
    });

    describe('validatePortBindings', function () {
        it('does not allow invalid host port', function () {
            expect(apps._validatePortBindings({ port: -1 }, { port: 5000 })).to.be.an(Error);
            expect(apps._validatePortBindings({ port: 0 }, { port: 5000 })).to.be.an(Error);
            expect(apps._validatePortBindings({ port: 'text' }, { port: 5000 })).to.be.an(Error);
            expect(apps._validatePortBindings({ port: 65536 }, { port: 5000 })).to.be.an(Error);
            expect(apps._validatePortBindings({ port: 470 }, { port: 5000 })).to.be.an(Error);
        });

        it('does not allow ports not as part of manifest', function () {
            expect(apps._validatePortBindings({ port: 1567 }, { })).to.be.an(Error);
            expect(apps._validatePortBindings({ port: 1567 }, { port3: null })).to.be.an(Error);
        });

        it('allows valid bindings', function () {
            expect(apps._validatePortBindings({ port: 1024 }, { port: 5000 })).to.be(null);

            expect(apps._validatePortBindings({
                port1: 4033,
                port2: 3242,
                port3: 1234
            }, { port1: null, port2: null, port3: null })).to.be(null);
        });
    });

    describe('getters', function () {
        it('cannot get invalid app', function (done) {
            apps.get('nope', function (error, app) {
                expect(error).to.be.ok();
                expect(error.reason).to.be(AppsError.NOT_FOUND);
                done();
            });
        });

        it('can get valid app', function (done) {
            apps.get(APP_0.id, function (error, app) {
                expect(error).to.be(null);
                expect(app).to.be.ok();
                expect(app.iconUrl).to.be(null);
                expect(app.fqdn).to.eql(APP_0.location + '.' + config.fqdn());
                expect(app.memoryLimit).to.eql(0);
                done();
            });
        });

        it('can getAll', function (done) {
            apps.getAll(function (error, apps) {
                expect(error).to.be(null);
                expect(apps).to.be.an(Array);
                expect(apps[0].id).to.be(APP_0.id);
                expect(apps[0].iconUrl).to.be(null);
                expect(apps[0].fqdn).to.eql(APP_0.location + '.' + config.fqdn());
                done();
            });
        });
    });

    describe('validateAccessRestriction', function () {
        it('allows null input', function () {
            expect(apps._validateAccessRestriction(null)).to.eql(null);
        });

        it('does not allow wrong user type', function () {
            expect(apps._validateAccessRestriction({ users: {} })).to.be.an(Error);
        });

        it('allows user input', function () {
            expect(apps._validateAccessRestriction({ users: [] })).to.eql(null);
        });

        it('allows single user input', function () {
            expect(apps._validateAccessRestriction({ users: [ 'someuserid' ] })).to.eql(null);
        });

        it('allows multi user input', function () {
            expect(apps._validateAccessRestriction({ users: [ 'someuserid', 'someuserid1', 'someuserid2', 'someuserid3' ] })).to.eql(null);
        });
    });

    describe('hasAccessTo', function () {
        it('returns true for unrestricted access', function (done) {
            apps.hasAccessTo({ accessRestriction: null }, { id: 'someuser' }, function (error, access) {
                expect(error).to.be(null);
                expect(access).to.be(true);
                done();
            });
        });

        it('returns true for allowed user', function (done) {
            apps.hasAccessTo({ accessRestriction: { users: [ 'someuser' ] } }, { id: 'someuser' }, function (error, access) {
                expect(error).to.be(null);
                expect(access).to.be(true);
                done();
            });
        });

        it('returns true for allowed user with multiple allowed', function (done) {
            apps.hasAccessTo({ accessRestriction: { users: [ 'foo', 'someuser', 'anotheruser' ] } }, { id: 'someuser' }, function (error, access) {
                expect(error).to.be(null);
                expect(access).to.be(true);
                done();
            });
        });

        it('returns false for not allowed user', function (done) {
            apps.hasAccessTo({ accessRestriction: { users: [ 'foo' ] } }, { id: 'someuser' }, function (error, access) {
                expect(error).to.be(null);
                expect(access).to.be(false);
                done();
            });
        });

        it('returns false for not allowed user with multiple allowed', function (done) {
            apps.hasAccessTo({ accessRestriction: { users: [ 'foo', 'anotheruser' ] } }, { id: 'someuser' }, function (error, access) {
                expect(error).to.be(null);
                expect(access).to.be(false);
                done();
            });
        });

        it('returns false for no group or user', function (done) {
            apps.hasAccessTo({ accessRestriction: { users: [ ], groups: [ ] } }, { id: 'someuser' }, function (error, access) {
                expect(error).to.be(null);
                expect(access).to.be(false);
                done();
            });
        });

        it('returns false for invalid group or user', function (done) {
            apps.hasAccessTo({ accessRestriction: { users: [ ], groups: [ 'nop' ] } }, { id: 'someuser' }, function (error, access) {
                expect(error).to.be(null);
                expect(access).to.be(false);
                done();
            });
        });
    });

    describe('getAllByUser', function () {
        it('succeeds for USER_0', function (done) {
            apps.getAllByUser(USER_0, function (error, result) {
                expect(error).to.equal(null);
                expect(result.length).to.equal(2);
                expect(result[0].id).to.equal(APP_0.id);
                expect(result[1].id).to.equal(APP_2.id);
                done();
            });
        });

        it('succeeds for USER_1', function (done) {
            apps.getAllByUser(USER_1, function (error, result) {
                expect(error).to.equal(null);
                expect(result.length).to.equal(2);
                expect(result[0].id).to.equal(APP_0.id);
                expect(result[1].id).to.equal(APP_1.id);
                done();
            });
        });

        it('succeeds with admin not being special', function (done) {
            apps.getAllByUser(ADMIN_0, function (error, result) {
                expect(error).to.equal(null);
                expect(result.length).to.equal(1);
                expect(result[0].id).to.equal(APP_0.id);
                done();
            });
        });
    });

    describe('configureInstalledApps', function () {
        before(function (done) {
            async.series([
                appdb.update.bind(null, APP_0.id, { installationState: appdb.ISTATE_INSTALLED }),
                appdb.update.bind(null, APP_1.id, { installationState: appdb.ISTATE_ERROR }),
                appdb.update.bind(null, APP_2.id, { installationState: appdb.ISTATE_INSTALLED })
            ], done);
        });

        it('can mark apps for reconfigure', function (done) {
            apps.configureInstalledApps(function (error) {
                expect(error).to.be(null);

                apps.getAll(function (error, apps) {
                    expect(apps[0].installationState).to.be(appdb.ISTATE_PENDING_CONFIGURE);
                    expect(apps[0].oldConfig).to.be(null);
                    expect(apps[1].installationState).to.be(appdb.ISTATE_PENDING_CONFIGURE); // erorred app can be reconfigured after restore
                    expect(apps[1].oldConfig).to.be(null);
                    expect(apps[2].installationState).to.be(appdb.ISTATE_PENDING_CONFIGURE);
                    expect(apps[2].oldConfig).to.be(null);

                    done();
                });
            });
        });
    });

    describe('restoreInstalledApps', function () {
        before(function (done) {
            async.series([
                appdb.update.bind(null, APP_0.id, { installationState: appdb.ISTATE_INSTALLED }),
                appdb.update.bind(null, APP_1.id, { installationState: appdb.ISTATE_ERROR }),
                appdb.update.bind(null, APP_2.id, { installationState: appdb.ISTATE_INSTALLED })
            ], done);
        });

        it('can mark apps for reconfigure', function (done) {
            apps.restoreInstalledApps(function (error) {
                expect(error).to.be(null);

                apps.getAll(function (error, apps) {
                    expect(apps[0].installationState).to.be(appdb.ISTATE_PENDING_RESTORE);
                    expect(apps[0].oldConfig).to.be(null);
                    expect(apps[1].installationState).to.be(appdb.ISTATE_PENDING_RESTORE);
                    expect(apps[2].installationState).to.be(appdb.ISTATE_PENDING_RESTORE);
                    expect(apps[2].oldConfig).to.be(null);

                    done();
                });
            });
        });
    });
});

