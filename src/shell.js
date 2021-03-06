'use strict';

exports = module.exports = {
    exec: exec,
    execSync: execSync,
    sudo: sudo,
    sudoSync: sudoSync
};

var assert = require('assert'),
    child_process = require('child_process'),
    debug = require('debug')('box:shell'),
    once = require('once'),
    util = require('util');

var SUDO = '/usr/bin/sudo';

function execSync(tag, cmd, callback) {
    assert.strictEqual(typeof tag, 'string');
    assert.strictEqual(typeof cmd, 'string');

    debug(cmd);
    try {
        child_process.execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        if (callback) return callback(e);
        throw e;
    }
    if (callback) callback();
}

function exec(tag, file, args, callback) {
    assert.strictEqual(typeof tag, 'string');
    assert.strictEqual(typeof file, 'string');
    assert(util.isArray(args));
    assert.strictEqual(typeof callback, 'function');

    callback = once(callback); // exit may or may not be called after an 'error'

    debug(tag + ' execFile: %s', file); // do not dump args as it might have sensitive info

    var cp = child_process.spawn(file, args);
    cp.stdout.on('data', function (data) {
        debug(tag + ' (stdout): %s', data.toString('utf8'));
    });

    cp.stderr.on('data', function (data) {
        debug(tag + ' (stderr): %s', data.toString('utf8'));
    });

    cp.on('exit', function (code, signal) {
        if (code || signal) debug(tag + ' code: %s, signal: %s', code, signal);
        if (code === 0) return callback(null);

        var e = new Error(util.format(tag + ' exited with error %s signal %s', code, signal));
        e.code = code;
        e.signal = signal;
        callback(e);
    });

    cp.on('error', function (error) {
        debug(tag + ' code: %s, signal: %s', error.code, error.signal);
        callback(error);
    });

    return cp;
}

function sudo(tag, args, callback) {
    assert.strictEqual(typeof tag, 'string');
    assert(util.isArray(args));
    assert.strictEqual(typeof callback, 'function');

    // -S makes sudo read stdin for password
    var cp = exec(tag, SUDO, [ '-S' ].concat(args), callback);
    cp.stdin.end();
    return cp;
}

function sudoSync(tag, cmd, callback) {
    assert.strictEqual(typeof tag, 'string');
    assert.strictEqual(typeof cmd, 'string');

    // -S makes sudo read stdin for password
    cmd = 'sudo -S ' + cmd;
    debug(cmd);

    try {
        child_process.execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        if (callback) return callback(e);
        throw e;
    }
    if (callback) callback();
}
