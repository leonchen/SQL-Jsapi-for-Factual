(function($){
  '$:nomunge'; 
  var interval_id,
    last_hash,
    cache_bust = 1,
    
    rm_callback,
    
    window = this,
    FALSE = !1,
    
    postMessage = 'postMessage',
    addEventListener = 'addEventListener',
    
    p_receiveMessage,
    
    has_postMessage = window[postMessage];
  
  $[postMessage] = function( message, target_url, target ) {
    if ( !target_url ) { return; }
    message = typeof message === 'string' ? message : $.param( message );
    
    target = target || parent;
    
    if ( has_postMessage ) {
      target[postMessage]( message, target_url.replace( /([^:]+:\/\/[^\/]+).*/, '$1' ) );
      
    } else if ( target_url ) {
      target.location = target_url.replace( /#.*$/, '' ) + '#' + (+new Date) + (cache_bust++) + '&' + message;
    }
  };
  $.receiveMessage = p_receiveMessage = function( callback, source_origin, delay ) {
    if (!this.callbacks) this.callbacks = [];
    this.callbacks.push(callback);
    var self = this;

    if ( has_postMessage ) {
      if ( callback ) {
        rm_callback && p_receiveMessage();
        rm_callback = function(e) {
          if ( ( typeof source_origin === 'string' && e.origin !== source_origin )
            || ( $.isFunction( source_origin ) && source_origin( e.origin ) === FALSE ) ) {
            return FALSE;
          }
          for (var i=0; i<self.callbacks.length; i++) {
            try {
              self.callbacks[i](e);
            } catch (e) {
            }
          }
        };
      }
      
      if ( window[addEventListener] ) {
        window[ callback ? addEventListener : 'removeEventListener' ]( 'message', rm_callback, FALSE );
      } else {
        window[ callback ? 'attachEvent' : 'detachEvent' ]( 'onmessage', rm_callback );
      }
      
    } else {
      this.interval_id && clearInterval( this.interval_id );
      this.interval_id = null;
      
      if ( callback ) {
        delay = typeof source_origin === 'number'
          ? source_origin
          : typeof delay === 'number'
            ? delay
            : 500;
        
        this.interval_id = setInterval(function(){
          var hash = document.location.hash,
            re = /^#?\d+&/;
          if ( hash !== last_hash && re.test( hash ) ) {
            last_hash = hash;
            for (var i=0; i<self.callbacks.length; i++) {
              try {
                self.callbacks[i]({ data: hash.replace( re, '' ) });
              } catch (e) {
              }
            }
          }
        }, delay );
      }
    }
  };
  
})($);
