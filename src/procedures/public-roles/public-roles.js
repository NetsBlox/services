/**
 * The PublicRoles Service provides access to the user's public role
 * ID programmatically. This enables communication between projects.
 *
 * @service
 * @category GLOBAL
 * @category Utilities
 */
"use strict";

const PublicRoles = {};

/**
 * Get the public role ID for the current role.
 *
 * @returns {String} the public role ID
 */
PublicRoles.getPublicRoleId = async function () {
  return await this.caller.getAddress();
};

/**
 * Get the public role ID for the current role.
 * @deprecated
 */
PublicRoles.requestPublicRoleId = function () {
  return PublicRoles.getPublicRoleId.call(this);
};

module.exports = PublicRoles;
