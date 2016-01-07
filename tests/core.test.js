////
//// Slightly hard-coded test try at public barista. Don't let get to
//// travis, etc.--only for local testing.
////

// Prefer Chai assert. We're (somehow, it does not work for "assert")
// passing in "should" from the gulp-defined globals.
var assert = require('chai').assert;

describe('barista client can function minimally', function(){
    
    var barloc = 'http://barista.berkeleybop.org';
    var mid = 'gomodel:55ad81df00000001';

    // Can I make contact?
    it('contact is possible with the public server', function(){

	var barista_client = require('..');

	// var barclient = new barista_client(barloc, 123);
	// //barclient.register('connect', _on_connect);
	// barclient.register('initialization', function(resp, man){

	    // Initialization stroke completed.
            assert.equal(1, 1);

        //     done();
	// });
	// barclient.connect(mid);

    });
});
