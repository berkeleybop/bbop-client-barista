/*
 * Manager for handling per-model client-to-client and
 * server-to-client communication via Barista.
 *
 * Let's try and communicate with the socket.io server (Barista) for
 * messages and the like--client-to-client communication.
 *
 * There are two major categories: "relay" and "query". Relays are for
 * passing information on to other clients (e.g. "where I am");
 * queries are for asking barista information about what it might know
 * (e.g. "where is X").
 *
 * @modules bbop-client-barista
 */

var bbop = require('bbop-core');
var registry = require('bbop-registry');
var us = require('underscore');

/*
 * Constructor: client
 *
 * Registry for client-to-client communication via Barista.
 */
var manager = function(barista_location, token){
    registry.call(this, ['connect',
			 'initialization',
			 //'disconnect',
			 'relay', // catch-all
			 'merge', // data is raw response 
			 'rebuild', // data is raw response 
			 'message',
			 'clairvoyance',
			 'telekinesis',
			 'query']); // asking barista something for yourself
    this._is_a = 'bbop-client-barista';
    
    var anchor = this;
    anchor._token = token;
    anchor.socket = null;
    anchor.model_id = null;
    anchor.okay_p = null;

    // These are the non-internal ones that we know about.
    var known_relay_classes = {
	'relay': true,
	// Specific forms of relay.
	'message': true,
	'merge': true,
	'rebuild': true,
	'clairvoyance': true,
	'telekinesis': true
    };
    var known_query_classes = {
	'query': true
    };

    var logger = new bbop.logger('barista client');
    logger.DEBUG = true;
    //logger.DEBUG = false;
    function ll(str){ logger.kvetch(str); }

    // Check to make sure that the library was correctly loaded.
    var io = require('socket.io-client');//(barista_location);
    if( typeof(io) === 'undefined' || typeof(io.connect) === 'undefined' ){
	ll('was unable to load server.io from messaging server (io undefined)');
	anchor.okay_p = false;
    }else{
	ll('likely have the right setup--attempting');
	anchor.okay_p = true;
    }	

    /*
     * Method: okay
     */
    anchor.okay = function(){
	var ret = false;
	//if( anchor.okay_p && anchor.socket && anchor.model_id ){
	if( anchor.okay_p ){
	    ret = true;
	}
	return ret;
    };

    /*
     * Method: token
     *
     * Operate on your identifying token.
     */
    anchor.token = function(in_token){
	if( in_token ){
	    anchor._token = in_token;
	}
	return anchor._token;
    };

    /*
     * Method: relay
     *
     * General structure for relaying information between clients.
     * Always check that the comm is on.
     * Always inject 'token' and 'model_id'.
     */
    anchor.relay = function(relay_class, data){
	if( ! anchor.okay() ){
	    ll('no good socket on location; did you connect()?');
	}else{
	    //ll('relay: (' + anchor.model_id + ', ' + anchor.token() + ')');

	    // Inject our data.
	    data['class'] = relay_class;
	    data['model_id'] = anchor.model_id;
	    data['token'] = anchor.token();

	    anchor.socket.emit('relay', data);
	}
    };

    /*
     * Method: query
     *
     * General structure for requesting information from Barista about
     * things it might know.
     * Always check that the comm is on.
     * Always inject 'token' and 'model_id'.
     */
    anchor.query = function(query_class, data){
	if( ! anchor.okay() ){
	    ll('no good socket on location; did you connect()?');
	}else{
	    ll('sending query: ('+ anchor.model_id +', '+ anchor.token() +')');

	    // Inject our data.
	    data['class'] = query_class;
	    data['model_id'] = anchor.model_id;
	    data['token'] = anchor.token();

	    anchor.socket.emit('query', data);
	}
    };

    /*
     * Method: get_layout
     *
     * Wrapper for the only thing query is currently used for.
     */
    anchor.get_layout = function(){
	anchor.query('query', {'query': 'layout'});
    };

    /*
     * Method: connect
     *
     * Required call before using messenger.
     *
     * TODO: Specify the channel over and above the general server.
     * For the time being, just using the model id in the message.
     */
    anchor.connect = function(model_id){
	if( ! anchor.okay() ){
	    ll('no good socket on connect; did you connect()?');
	}else{

	    // Set internal variables and make actual connection.
	    //anchor.socket = io.connect(barista_location + '/messenger');
	    anchor.socket = io.connect(barista_location);
	    anchor.model_id = model_id;
	    anchor.socket_id = anchor.socket.id;
	    
	    var _inject_data_with_client_info = function(data){
		if( ! data ){
		    data = {};
		    //}else{
		}

		// // Standard.
		// data['model_id'] = anchor.model_id;
		// data['socket_id'] = anchor.socket_id;
		// data['token'] = anchor.token();

		// // Optional.
		// data['message_type'] = null;
		// data['message'] = null;
		// data['signal'] = null;
		// data['intention'] = null;
		// data['top'] = null;
		// data['left'] = null;
		// data['data'] = null;
		// data['state'] = null;
		
		return data;
	    };

	    // Check whether ot not we should ignore the incoming
	    // data.
	    var _applys_to_us_p = function(data){
		var ret = false;

		var mid = data['model_id'] || null;
		if( ! mid || mid !== anchor.model_id ){
		    ll('skip packet--not for us');
		}else{
		    ret = true;
		}

		return ret;
	    };

	    // This internal connect is special since no data is
	    // actually coming from the outsice world.
	    anchor.socket.on('connect', function (empty_placeholder){
		var data = _inject_data_with_client_info(empty_placeholder);

		// Let others know that I have connected using the 
		data['message_type'] = 'success';
		data['message'] = 'new client connected';
		//anchor.socket.emit('relay', data);
		anchor.relay('message', data);

		// Run appropriate callbacks.
		ll('apply "connect" callbacks');
		anchor.apply_callbacks('connect', [data]);
	    });

	    // Our initialization data from the server.
	    anchor.socket.on('initialization', function (data){
		data = _inject_data_with_client_info(data);
		//ll('received initialization info from socket: ' + sid);
		
		// Run appropriate callbacks.
		ll('apply "initialization" callbacks');
		anchor.apply_callbacks('initialization', [data]);
	    });

	    // Setup to catch info events from the clients and pass
	    // them on if they were meant for us. 
	    anchor.socket.on('relay', function(data){
		data = _inject_data_with_client_info(data);

		// Check to make sure it interests us.
		if( _applys_to_us_p(data) ){

		    var dclass = data['class'];
		    if( ! dclass ){
			ll('no relay class found');
		    }else if( ! known_relay_classes[dclass] ){
			ll('unknown relay class: ' + dclass);
		    }else{
			// Run appropriate callbacks.
			ll('apply (relay) "'+ dclass +'" callbacks');
			anchor.apply_callbacks(dclass, [data]);
		    }
		}
	    });

	    // Setup to catch query events from things we'veasked
	    // barista.
	    anchor.socket.on('query', function(data){
		data = _inject_data_with_client_info(data);

		// Check to make sure it interests us.
		if( _applys_to_us_p(data) ){

		    var dclass = data['class'];
		    if( ! dclass ){
			ll('no query class found');
		    }else if( ! known_query_classes[dclass] ){
			ll('unknown query class: ' + dclass);
		    }else{
			// Run appropriate callbacks.
			ll('apply (query) "'+ dclass +'" callbacks');
			anchor.apply_callbacks(dclass, [data]);
		    }
		}
	    });
     	}
    };

    /*
     * Method: message
     *
     * Just a message.
     */
    anchor.message = function(m){
	m['class'] = 'message';
	// var packet = {
	//     'class': 'message',
	//     'message_type': m['message_type'],
	//     'message': m['message'],
	//     'me': m['message_type'],
	//     'message_type': m['message_type']
	// };
	// anchor.relay('message', packet);
	anchor.relay('message', m);
    };

    /*
     * Method: clairvoyance
     *
     * Remote awareness of our location.
     */
    anchor.clairvoyance = function(top, left){
	var packet = {
	    'class': 'clairvoyance',
	    'top': top,
	    'left': left
	};
	anchor.relay('clairvoyance', packet);
    };

    /*
     * Method: telekinesis
     *
     * Move objects at a distance.
     */
    anchor.telekinesis = function(item_id, top, left){
	var packet = {
	    'class': 'telekinesis',
	    'objects': [{
		'item_id': item_id,
		'top': top,
		'left': left
	    }]
	};
	anchor.relay('telekinesis', packet);
    };

};
bbop.extend(manager, registry);

///
/// Exportable body.
///

module.exports = manager;
