const utils = require('../../../../../assets/utils');

describe(utils.suiteName(__filename), function() {
    const ApiConsumer = require('../../../../../../src/server/services/procedures/utils/api-consumer.js'),
        apiConsumer = new ApiConsumer('testConsumer',''),
        MockService = require('../../../../../assets/mock-service'),
        assert = require('assert');
    let testRpc;

    before(() => testRpc = new MockService(apiConsumer));
    after(() => testRpc.destroy());

    describe('cache manager filestorage store', function(){
        it('should be able to save and read data to and from cache', done=>{
            let cache = testRpc.unwrap()._cache;
            cache.set('foo', 'bar', function(err) {
                if (err) { throw err; }
                cache.get('foo', function(err, result) {
                    assert(result,'bar');
                    cache.del('foo', done);
                });
            });
        });
    });

    describe('_getFullUrl', () => {
        const baseUrl = 'https://abc.com';
        let service;

        before(() => service = testRpc.unwrap());

        it('should override url with "url" option', function() {
            const options = {baseUrl, queryString: 'a=b&c=d'};
            options.url = 'http://github.com';
            const url = service._getFullUrl(options);
            assert.equal(url, options.url);
        });

        it('should add ? before query string', function() {
            const url = service._getFullUrl({baseUrl, queryString: 'a=b&c=d'});
            assert.equal(url, `${baseUrl}?a=b&c=d`);
        });

        it('should not add ? before query string if exists', function() {
            const url = service._getFullUrl({baseUrl, queryString: '?a=b&c=d'});
            assert.equal(url, `${baseUrl}?a=b&c=d`);
        });

        it('should add / before path', function() {
            const url = service._getFullUrl({baseUrl, path: 'test/path'});
            assert.equal(url, `${baseUrl}/test/path`);
        });

        it('should not add / before path if exists', function() {
            const url = service._getFullUrl({baseUrl, path: '/test/path'});
            assert.equal(url, `${baseUrl}/test/path`);
        });
    });

    describe('_checkInvalidApiKey', function() {
        const mockKey = {provider: 'Test'};
        let service;

        before(() => {
            service = testRpc.unwrap();
            service.apiKey = mockKey;
        });

        it('should throw invalid API key error on 403', function() {
            assert.throws(
                () => service._checkInvalidApiKey(403),
                /Invalid API key/
            );
        });

        it('should not throw invalid API key error on 500', function() {
            service._checkInvalidApiKey(500);
        });

        it('should not throw invalid API key error on 404', function() {
            service._checkInvalidApiKey(404);
        });
    });

    describe('requestData', ()=>{

        it('should get correct data from the endpoint', done => {
            let queryOpts = {
                queryString: '/',
                baseUrl: 'http://google.com',
                json: false
            };
            apiConsumer._requestData(queryOpts).then(data => {
                assert(data.match(/www\.google\.com/).length > 0);
                done();
            }).catch(e => {
                done(e);
            });
        });

        it('should get response from the cache', done => {
            let cache = testRpc.unwrap()._cache;
            let queryOpts = {
                queryString: '',
                baseUrl: 'http://google.com',
                json: false
            };

            let requestCacheKey = testRpc.unwrap()._getCacheKey(queryOpts);
            // cache the key for this request to 'response'
            cache.set(requestCacheKey, 'response', function(err) {
                if (err) { throw err; }
                testRpc.unwrap()._requestData(queryOpts)
                    .then(data => {
                    // requesting for the same key should return 'response' as data
                        assert.deepEqual(data,'response');
                        done();
                    });
            });
        });

        it('should not allow cache of 0', () => {
            assert.throws(
                () => new ApiConsumer('InvalidCacheTime','', {cache: {ttl: 0}}),
                /caching is required/
            );
        });

        it('should throw when requesting a nonexisting resource', done => {
            const queryOpts = {
                queryString: '/',
                baseUrl: 'http://AAnonexistingdomainadslfjazxcvsadf.com',
                json: false
            };
            const errorMsg = 'this request shouldn\'t resolve';
            apiConsumer._requestData(queryOpts).then(() => {
                // we shouldn't get here, fail the test if we get here
                throw new Error(errorMsg);
            }).catch(e => {
                assert.deepEqual(e.name, 'RequestError');
                done();
            });
        });

        it('should not cache rejected promises', done => {
            const queryOpts = {
                queryString: '/',
                baseUrl: 'http://BBnonexistingdomainadslfjazxcvsadf.com',
                json: false
            };
            apiConsumer._requestData(queryOpts).catch( () => {
                // check if it is cached or not
                testRpc.unwrap()._cache.get(queryOpts.baseUrl + queryOpts.queryString, function(err, result) {
                    assert.equal(err,null);
                    assert.equal(result,null);
                    done();
                });
            });
        });

    });
}); // end of ApiConsumer describe
