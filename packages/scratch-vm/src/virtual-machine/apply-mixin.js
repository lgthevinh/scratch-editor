/**
 * Copy a mixin class's own prototype members (methods and accessors) onto a target class's
 * prototype, preserving property descriptors so getters stay getters. The mixin's constructor is
 * skipped; mixed-in members run with `this` bound to the target instance at call time.
 * @param {Function} TargetClass - the class to augment (its prototype is mutated).
 * @param {Function} MixinClass - the class whose prototype members are copied.
 * @returns {void}
 */
module.exports = (TargetClass, MixinClass) => {
    for (const key of Object.getOwnPropertyNames(MixinClass.prototype)) {
        if (key === 'constructor') continue;
        Object.defineProperty(
            TargetClass.prototype,
            key,
            Object.getOwnPropertyDescriptor(MixinClass.prototype, key)
        );
    }
};
