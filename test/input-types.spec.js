const utils = require('../../../assets/utils');

describe(utils.suiteName(__filename), function() {
    const InputTypes = require('../../../../src/server/services/input-types');
    const typesParser = InputTypes.parse;
    const assert = require('assert');

    describe('String', function() {
        it('should convert to a string', async () => {
            let rawInput = 0;
            let parsedInput = await typesParser.String(rawInput);
            assert.strictEqual(typeof parsedInput, 'string');
        });
    });

    describe('Any', function() {
        it('should leave as a string', () => {
            let rawInput = '4.253';
            let parsedInput = typesParser.Any(rawInput);
            assert.strictEqual(parsedInput, rawInput);
        });
    });

    describe('Number', function() {
        it('should parse into JS numbers', async () => {
            let rawInput = '4.253';
            let parsedInput = await typesParser.Number(rawInput);
            assert.deepStrictEqual(parsedInput, 4.253);
        });
    });

    describe('Union', function() {
        before(() => InputTypes.defineType({
            name: 'SomeUnion',
            description: 'test',
            baseType: 'Union',
            baseParams: ['Array', 'Boolean', 'Number'],
        }));

        it('should accept the first successful parse', async () => {
            assert.deepStrictEqual(await typesParser.SomeUnion(12), 12);
            assert.deepStrictEqual(await typesParser.SomeUnion('12'), 12);
            assert.deepStrictEqual(await typesParser.SomeUnion('true'), true);
            assert.deepStrictEqual(await typesParser.SomeUnion('FALSE'), false);
            assert.deepStrictEqual(await typesParser.SomeUnion([1,2,3]), [1,2,3]);
        });
        it('should reject unspecified types', async () => {
            await assert.rejects(() => typesParser.SomeUnion('hello world'));
        });
    });

    describe('Integer', function() {
        it('should parse into JS numbers', async () => {
            let rawInput = '54';
            let parsedInput = await typesParser.Integer(rawInput);
            assert.deepStrictEqual(parsedInput, 54);

            rawInput = '-4';
            parsedInput = await typesParser.Integer(rawInput);
            assert.deepStrictEqual(parsedInput, -4);
        });
        it('should not allow fractional values', async () => {
            await assert.rejects(() => typesParser.Integer('7.5'));
        });
        it('should not allow non-numbers', async () => {
            await assert.rejects(() => typesParser.Integer('hello'));
        });
    });
    describe('BoundedInteger', function() {
        const params = [7, 21]; // min, max
        it('should not allow fractional values', async () => {
            await utils.shouldThrow(() => typesParser.BoundedInteger('7.5', params));
        });
        it('should not allow non-numbers', async () => {
            await utils.shouldThrow(() => typesParser.BoundedInteger('hello', params));
        });
        it('should allow numbers between min and max', async () => {
            let rawInput = '12';
            let parsedInput = await typesParser.BoundedInteger(rawInput, params);
            assert.deepStrictEqual(parsedInput, 12);

            rawInput = '20';
            parsedInput = await typesParser.BoundedInteger(rawInput, params);
            assert.deepStrictEqual(parsedInput, 20);
        });
        it('should allow numbers equal to min and max', async () => {
            let rawInput = '7';
            let parsedInput = await typesParser.BoundedInteger(rawInput, params);
            assert.deepStrictEqual(parsedInput, 7);

            rawInput = '21';
            parsedInput = await typesParser.BoundedInteger(rawInput, params);
            assert.deepStrictEqual(parsedInput, 21);
        });
        it('should not allow numbers below min', async () => {
            await utils.shouldThrow(() => typesParser.BoundedInteger('6', params));
            await utils.shouldThrow(() => typesParser.BoundedInteger('-3', params));
        });
        it('should not allow numbers above max', async () => {
            await utils.shouldThrow(() => typesParser.BoundedInteger('22', params));
            await utils.shouldThrow(() => typesParser.BoundedInteger('87', params));
        });
    });

    describe('Array', function() {
        it('should throw error w/ numeric input', async () => {
            let rawInput = '181',
                type = 'Array';

            await utils.shouldThrow(() => typesParser[type](rawInput));
        });

        it('should throw error w/ string input', async () => {
            let rawInput = 'cat',
                type = 'Array';

            await utils.shouldThrow(() => typesParser[type](rawInput));
        });

        it('should throw invalid nested types', async () => {
            await utils.shouldThrow(() => typesParser.Array(['text'], ['Number']));
        });

        it('should support nested types', () => {
            typesParser.Array([1, 2], ['Number']);
        });
        it('should support complex nested types', () => {
            typesParser.Array([1, 2], [{ name: 'BoundedNumber', params: [1, 2] }]);
        });

        it('should enforce bounded lengths', async () => {
            await utils.shouldThrow(() => typesParser.Array([], [undefined, 2]));
            await utils.shouldThrow(() => typesParser.Array([1], [undefined, 2]));
            typesParser.Array([1, 2], [undefined, 2]);
            typesParser.Array([1, 2, 3], [undefined, 2]);

            await utils.shouldThrow(() => typesParser.Array([1, 2, 3, 4, 5, 6], [undefined, undefined, 4]));
            await utils.shouldThrow(() => typesParser.Array([1, 2, 3, 4, 5], [undefined, undefined, 4]));
            typesParser.Array([1, 2, 3, 4], [undefined, undefined, 4]);
            typesParser.Array([1, 2, 3], [undefined, undefined, 4]);

            await utils.shouldThrow(() => typesParser.Array([], [undefined, 3, 4]));
            await utils.shouldThrow(() => typesParser.Array([1], [undefined, 3, 4]));
            await utils.shouldThrow(() => typesParser.Array([1, 2], [undefined, 3, 4]));
            await utils.shouldThrow(() => typesParser.Array([1, 2, 3, 4, 5], [undefined, 3, 4]));
            typesParser.Array([1, 2, 3, 4], [undefined, 3, 4]);
            typesParser.Array([1, 2, 3], [undefined, 3, 4]);
        });
    });

    describe('Tuple', function() {
        before(() => {
            InputTypes.defineType({
                name: 'SomeTupleA',
                description: 'test',
                baseType: 'Tuple',
                baseParams: ['Integer'],
            });
            InputTypes.defineType({
                name: 'SomeTupleB',
                description: 'test',
                baseType: 'Tuple',
                baseParams: ['Integer', 'String'],
            });
            InputTypes.defineType({
                name: 'SomeTupleC',
                description: 'test',
                baseType: 'Tuple',
                baseParams: ['Integer', 'Array', 'String'],
            });
        });

        it('should throw for non-array input', async () => {
            await utils.shouldThrow(() => typesParser.SomeTupleA(12));
            await utils.shouldThrow(() => typesParser.SomeTupleA('12'));
            assert.deepStrictEqual(await typesParser.SomeTupleA(['12']), [12]);
        });
        it('should throw on wrong arity input', async () => {
            await utils.shouldThrow(() => typesParser.SomeTupleB([]));
            await utils.shouldThrow(() => typesParser.SomeTupleB(['12']));
            assert.deepStrictEqual(await typesParser.SomeTupleB(['12', 'hello']), [12, 'hello']);
            await utils.shouldThrow(() => typesParser.SomeTupleB(['12', 'hello', []]));
        });
        it('should accept only correct type sequence', async () => {
            await utils.shouldThrow(() => typesParser.SomeTupleC(['12.4', [], 'hello']));
            await utils.shouldThrow(() => typesParser.SomeTupleC(['12', '67', 'hello']));
            await utils.shouldThrow(() => typesParser.SomeTupleC(['12', '67', 'hello']));
            assert.deepStrictEqual(await typesParser.SomeTupleC(['12', ['finally'], 'hello']), [12, ['finally'], 'hello']);
        });
    });

    describe('Date', function() {
        const DATE_EPSILON_MS = 1000;
        const assertDatesEq = (a, b) => {
            const dist = Math.abs(+a - +b);
            assert(Math.abs(+a - +b) < DATE_EPSILON_MS, `not (approx) equal: |${+a} - ${+b}| = ${dist}\n(${a} vs ${b})`);
        };
        const parse = typesParser.Date;

        it('should allow normal date formats', async () => {
            assertDatesEq(await parse('2020/10/3'), new Date('2020/10/3'));
            assertDatesEq(await parse('  2020/10/3  '), new Date('2020/10/3'));
            assertDatesEq(await parse(2353436446), new Date(2353436446));
            assertDatesEq(await parse('2353436446'), new Date(2353436446));
            assertDatesEq(await parse('  2353436446  '), new Date(2353436446));
        });

        it('should stop on +/- for base date parsing', async () => {
            assertDatesEq(await parse('now -1d'), +new Date() - 1*24*60*60*1000);
            assertDatesEq(await parse('now -3d'), +new Date() - 3*24*60*60*1000);
            assertDatesEq(await parse('now -10d'), +new Date() - 10*24*60*60*1000);
            assertDatesEq(await parse('now -30d'), +new Date() - 30*24*60*60*1000);

            assertDatesEq(await parse('now +1d'), +new Date() + 1*24*60*60*1000);
            assertDatesEq(await parse('now +3d'), +new Date() + 3*24*60*60*1000);
            assertDatesEq(await parse('now +10d'), +new Date() + 10*24*60*60*1000);
            assertDatesEq(await parse('now +30d'), +new Date() + 30*24*60*60*1000);
        });

        it('should allow slightly extended unix timestamps', async () => {
            assertDatesEq(await parse('+2353436446'), new Date(2353436446));
            assertDatesEq(await parse('  +2353436446  '), new Date(2353436446));
            assertDatesEq(await parse('  +  2353436446  '), new Date(2353436446));
        });

        it('should support meta times', async () => {
            assertDatesEq(await parse('now'), new Date());
            assertDatesEq(await parse('  now  '), new Date());
            assertDatesEq(await parse('today'), new Date().setHours(0,0,0,0));
            assertDatesEq(await parse('  today  '), new Date().setHours(0,0,0,0));
        });

        it('should support time offsets', async () => {
            assertDatesEq(await parse('  2020/10/3   +12d'), new Date('2020/10/15'));
            assertDatesEq(await parse('2020/10/3+12d'), new Date('2020/10/15'));
            assertDatesEq(await parse(' 2020/10/3  +12d    -2day  '), new Date('2020/10/13'));
            assertDatesEq(await parse(' 2020/10/3  +12d    -2day -1  week '), new Date('2020/10/6'));
            assertDatesEq(await parse('  2020/10/3+12days-2d  '), new Date('2020/10/13'));
            assertDatesEq(await parse('2353436446 +20m -10secs +4000ms'), new Date(2353436446 + 20*60*1000 -10*1000 + 4000));
            assertDatesEq(await parse('+2353436446 +20m -10secs +4000  ms'), new Date(2353436446 + 20*60*1000 -10*1000 + 4000));
            assertDatesEq(await parse('+  2353436446 +20m -10secs +4000ms'), new Date(2353436446 + 20*60*1000 -10*1000 + 4000));
            assertDatesEq(await parse('   +2353436446 +20  mins -10secs +4000ms'), new Date(2353436446 + 20*60*1000 -10*1000 + 4000));
            assertDatesEq(await parse('   +2353436446+   20m -10secs +4000ms'), new Date(2353436446 + 20*60*1000 -10*1000 + 4000));
            assertDatesEq(await parse('   +  2353436446 +20m -10secs +4000ms'), new Date(2353436446 + 20*60*1000 -10*1000 + 4000));
            assertDatesEq(await parse('   +  2353436446+ 20m-10secs +  4000ms'), new Date(2353436446 + 20*60*1000 -10*1000 + 4000));
        });
    });

    describe('Duration', function() {
        const parse = typesParser.Duration;

        it('should parse chained durations', async () => {
            assert.deepStrictEqual(await parse(' 12d  '), 12*24*60*60*1000);
            assert.deepStrictEqual(await parse(' 12d  -  5    hrs  '), 12*24*60*60*1000 - 5*60*60*1000);
            assert.deepStrictEqual(await parse(' 5s - 10s + 12ms'), 5*1000 - 10*1000 + 12);
        });
    });

    describe('Object', function() {
        it('should throw error if input has a pair of size 0', async () => {
            let rawInput = [[], ['a', 234],['name', 'Hamid'], ['connections', ['b','c','d']]];
            let type = 'Object';
            const err = await utils.shouldThrow(() => typesParser[type](rawInput));
            assert(/It should be a list of/.test(err.message));
        });

        it('should throw error if input has a pair of length more than 2', async () => {
            let rawInput = [['a', 234],['name', 'Hamid', 'Z'], ['connections', ['b','c','d']]];
            let type = 'Object';
            const err = await utils.shouldThrow(() => typesParser[type](rawInput));
            assert(/It should be a list of/.test(err.message));
        });

        it('should not throw if input has a pair of length 1', () => {
            let rawInput = [['a', 234],['name', 'Hamid'], ['connections', ['b','c','d']], ['children']];
            let type = 'Object';
            assert(typesParser[type](rawInput));
        });

        it('should parse structured data to json', async () => {
            let rawInput = [['a', 234],['name', 'Hamid'], ['connections', ['b','c','d']], ['children']];
            let parsedInput = await typesParser.Object(rawInput);
            assert.deepStrictEqual(parsedInput.name, 'Hamid');
        });

        describe('duck typing', function() {
            function param(name, type, optional=false) {
                return {
                    name,
                    optional,
                    type: {
                        name: type
                    }
                };
            }

            it('should not support additional fields', async function() {
                const input = [['name', 'Donald Duck'], ['age', 50]];
                const err = await utils.shouldThrow(
                    () => typesParser.Object(input, [param('name', 'String')]),
                );
                assert(/extra fields/.test(err.message));
            });

            it('should support optional fields', async function() {
                const input = [];
                const parsedInput = await typesParser.Object(input, [param('name', 'String', true)]);
                assert.deepEqual(parsedInput, {});
            });

            it('should treat null values as unset', async function() {
                const input = [['name', null]];
                const parsedInput = await typesParser.Object(input, [param('name', 'String', true)]);
                assert.deepEqual(parsedInput, {});
            });

            it('should treat undefined values as unset', async function() {
                const input = [['name', undefined]];
                const parsedInput = await typesParser.Object(input, [param('name', 'String', true)]);
                assert.deepEqual(parsedInput, {});
            });

            it('should parse fields', async function() {
                const input = [['age', '50']];
                const parsedInput = await typesParser.Object(input, [param('age', 'Number')]);
                assert.deepEqual(parsedInput.age, 50);
            });

            it('should support required fields', async function() {
                const input = [['name', 'Donald Duck']];
                const err = await utils.shouldThrow(
                    () => typesParser.Object(input, [param('name', 'String'), param('age', 'Number')]),
                );
                assert(/must contain/.test(err.message));
            });

            it('should be optional if no params', function() {
                const input = [['name', 'Donald Duck']];
                typesParser.Object(input, []);
            });
        });
    });

    describe('Latitude', function() {
        const type = 'Latitude';

        it('should throw on latitudes less than -90', async () => {
            let rawInput = '-91';
            await assert.rejects(() => typesParser[type](rawInput));
        });

        it('should throw on latitudes more than 90', async () => {
            let rawInput = '91';
            await assert.rejects(() => typesParser[type](rawInput));
        });

    });

    describe('Longitude', function() {
        const type = 'Longitude';

        it('should throw on longitude less than -180', async () => {
            let rawInput = '-181';
            await assert.rejects(() => typesParser[type](rawInput));
        });

        it('should throw on longitude more than 180', async () => {
            let rawInput = '181';
            await assert.rejects(() => typesParser[type](rawInput));
        });

    });

    describe('BoundedNumber', function() {
        const type = 'BoundedNumber';

        it('should include minimum value', async () => {
            let rawInput = '10';
            await typesParser[type](rawInput, [10, 180]);
        });

        it('should not throw if within range', async () => {
            let rawInput = '-151';
            await typesParser[type](rawInput, [-180, 180]);
        });

        it('should return Number (not string)', async () => {
            const input = '10';
            const value = await typesParser[type](input, [0, 21]);
            assert.strictEqual(typeof value, 'number');
        });

        it('should throw if less than min', async () => {
            let rawInput = '-181';
            const err = await utils.shouldThrow(() => typesParser[type](rawInput, [-180, 180]));
            assert(/-180/.test(err.message));
        });

        it('should throw if more than max', async () => {
            let rawInput = '181';
            const err = await utils.shouldThrow(() => typesParser[type](rawInput, ['-180', '180']));
            assert(/180/.test(err.message));
        });

        it('should throw if below minimum (w/o max)', async () => {
            let rawInput = '-181';
            const err = await utils.shouldThrow(() => typesParser[type](rawInput, ['-180']));
            assert(/180/.test(err.message));
        });

        it('should not print NaN in error if below minimum (w/o max)', () => {
            let rawInput = '-181';
            try {
                typesParser[type](rawInput, ['-180']);
            } catch (err) {
                assert(!err.message.includes('NaN'));
            }
        });

        it('should accept if above minimum (w/o max)', () => {
            const rawInput = '10';
            typesParser[type](rawInput, ['9']);
        });
    });

    describe('BoundedString', function() {
        const type = 'BoundedString';

        it('should include minimum length', async () => {
            let rawInput = 'a';
            await typesParser[type](rawInput, [1, 180]);
        });

        it('should not throw if within range', async () => {
            let rawInput = 'abc';
            await typesParser[type](rawInput, [2, 180]);
        });

        it('should throw if less than min', async () => {
            let rawInput = 'a';
            const err = await utils.shouldThrow(() => typesParser[type](rawInput, [4, 180]));
            assert(/4/.test(err.message));
        });

        it('should throw if more than max', async () => {
            let rawInput = 'abcdefg';
            const err = await utils.shouldThrow(() => typesParser[type](rawInput, [2, 4]));
            assert(/4/.test(err.message));
        });

        it('should throw if below minimum (w/o max)', async () => {
            let rawInput = 'abc';
            const err = await utils.shouldThrow(() => typesParser[type](rawInput, [5]));
            assert(/5/.test(err.message));
        });

        it('should accept if above minimum (w/o max)', () => {
            const rawInput = 'abcdefg';
            typesParser[type](rawInput, [5]);
        });
    });

    describe('Enum', function() {
        const type = 'Enum';

        it('should take an array of variants and return variant', async () => {
            const vars = ['dog', 'Cat', 'puPPy', 'KITTEN'];
            assert.deepEqual(await typesParser[type]('dog', vars), 'dog');
            assert.deepEqual(await typesParser[type]('dOg', vars), 'dog');
            assert.deepEqual(await typesParser[type]('Cat', vars), 'Cat');
            assert.deepEqual(await typesParser[type]('cat', vars), 'Cat');
            assert.deepEqual(await typesParser[type]('puPPy', vars), 'puPPy');
            assert.deepEqual(await typesParser[type]('pupPY', vars), 'puPPy');
            assert.deepEqual(await typesParser[type]('KITTEN', vars), 'KITTEN');
            assert.deepEqual(await typesParser[type]('kitten', vars), 'KITTEN');
        });
        it('should take an object of variant key value pairs and return mapped value', async () => {
            const vars = { dog: 5, Cat: -6, puPPy: 3, KITTEN: ['hello', 'world'] };
            assert.deepEqual(await typesParser[type]('dog', vars), 5);
            assert.deepEqual(await typesParser[type]('dOG', vars), 5);
            assert.deepEqual(await typesParser[type]('Cat', vars), -6);
            assert.deepEqual(await typesParser[type]('CAT', vars), -6);
            assert.deepEqual(await typesParser[type]('puPPy', vars), 3);
            assert.deepEqual(await typesParser[type]('puppy', vars), 3);
            assert.deepEqual(await typesParser[type]('KITTEN', vars), ['hello', 'world']);
            assert.deepEqual(await typesParser[type]('kitteN', vars), ['hello', 'world']);
        });
    });

    describe('Boolean', function() {
        const type = 'Boolean';

        it('should accept true and false (actual bool values)', async () => {
            assert.strictEqual(await typesParser[type](true), true);
            assert.strictEqual(await typesParser[type](false), false);
        });
        it('should accept true and false (case insensitive)', async () => {
            assert.strictEqual(await typesParser[type]('true'), true);
            assert.strictEqual(await typesParser[type]('TruE'), true);
            assert.strictEqual(await typesParser[type]('false'), false);
            assert.strictEqual(await typesParser[type]('faLSe'), false);
        });
    });

    describe('SerializedFunction', function() {
        it('should throw an error if doesnt compile', async function() {
            await utils.shouldThrow(() => typesParser.SerializedFunction('thisIsNotXml'));
        });

        it('should return an xml string', async function() {
            const reportStopping = '<context id="1"><inputs></inputs><variables></variables><script><block collabId="item_204" s="doReport"><l>Stopping!</l></block></script><receiver><sprite name="Sprite" collabId="item_-1" idx="1" x="-450.67597895992844" y="-174.19822319735795" heading="90" scale="1" rotation="1" draggable="true" costume="1" color="80,80,80" pen="tip" id="6"><costumes><list struct="atomic" id="7"></list></costumes><sounds><list struct="atomic" id="8"></list></sounds><variables></variables><blocks></blocks><scripts></scripts></sprite></receiver><origin><ref id="6"></ref></origin><context id="11"><inputs></inputs><variables></variables><receiver><ref id="6"></ref></receiver><origin><ref id="6"></ref></origin></context></context>';
            const xml = await typesParser.SerializedFunction(reportStopping);
            assert.equal(typeof xml, 'string');
        });
    });

    describe('defineType', function() {
        before(() => InputTypes.defineType({
            name: 'NewType',
            description: 'test',
            baseType: 'Any',
            parser: input => Math.pow(+input, 2),
        }));

        it('should not be able to define the same type twice', async function() {
            await utils.shouldThrow(() => InputTypes.defineType({
                name: 'NewType',
                description: 'test',
                baseType: 'Any',
                parser: input => input,
            }));
        });
    });

    describe('withTypeTape', function() {
        it('should return newly defined types', function() {
            const [types,] = InputTypes.withTypeTape(() => {
                InputTypes.defineType({
                    name: 'NewType2',
                    description: 'test',
                    baseType: 'Any',
                    parser: input => input,
                });
                InputTypes.defineType({
                    name: 'NewType3',
                    description: 'test',
                    baseType: 'Any',
                    parser: input => input,
                });
            });
            assert.deepEqual(types.map(t => t.meta.displayName), ['NewType2', 'NewType3']);
        });

        it('should throw error if global type depends on service type', function() {
            InputTypes.withTypeTape(() => {
                InputTypes.defineType({
                    name: 'BaseServiceType',
                    description: 'test',
                    baseType: 'Any',
                    parser: input => input,
                });
            });

            assert.throws(() => InputTypes.defineType({
                name: 'DependentGlobalType',
                description: 'test',
                baseType: 'BaseServiceType',
                parser: input => input,
            }));
        });

        it('should not register types', function() {
            InputTypes.withTypeTape(() => {
                InputTypes.defineType({
                    name: 'NewUnregisteredType',
                    description: 'test',
                    baseType: 'Any',
                    parser: input => input,
                });
            });
            assert.equal(InputTypes.parse.NewUnregisteredType, undefined);
        });

        it.skip('should allow name collisions from different services', function() {
            let [types] = InputTypes.withTypeTape(() => {
                InputTypes.defineType({
                    name: 'ServiceType',
                    description: 'test',
                    baseType: 'Any',
                    parser: input => input,
                });
            });
            types.forEach(argType => InputTypes.registerType(argType, 'Service1'));
            [types] = InputTypes.withTypeTape(() => {
                InputTypes.defineType({
                    name: 'ServiceType',
                    description: 'test',
                    baseType: 'Any',
                    parser: input => input,
                });
            });
            types.forEach(argType => InputTypes.registerType(argType, 'Service2'));
        });
    });
});
