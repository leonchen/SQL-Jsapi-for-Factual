;Klass = { 
  debug: false,
  cMPrefixRegexp: /^\$/,
  pMPrefixRegexp: /^_/,
  reservedAttributes: ['self', '_super', 'klassName', 'parentKlass', 'klass', '$new', '$singleton', '$subKlass', '$extend', '_singletonInstance', 'classMethods', 'instanceMethods', 'prototype', '_tmpSuperMethod'],
  controllableAttributes: ['Mixins', 'Abstract', 'Singleton'],
  superMethod: 'var _super=function(){var s=self;var c=arguments.callee.caller;var fN=c._functionName;var pK=c._parentKlass;if(!pK){pK=s.klass?s.klass.parentKlass:s.parentKlass};var idx=0;while(s["_tmpSuperMethod"+idx]){idx++;}var tN="_tmpSuperMethod"+idx;eval("self."+tN+"="+pK.prototype[fN].toString());s[tN]._parentKlass=pK.parentKlass;s[tN]._functionName=fN;var r=s[tN].apply(s,arguments);delete s[tN];return r;};',

  create: function (name) {
    var prototype = arguments[1] || {};
    prototype = this.applyMixins(prototype);
    var path  = this.getGlobalPath(name); 
    try {
      var klass = path[0][path[1]] = this.createKlass(prototype, name);
    } catch (e) {
      this.log("Failed to create Klass: " + name);
    }
    return klass;
  },

  extend: function (klass, prototype) {
    var path  = this.getGlobalPath(klass.klassName); 
    var k = path[0][path[1]] = this.createKlass(this.mergePrototype(this.klassPrototype(klass), prototype), klass.klassName, klass.parentKlass);
    return k;
  },

  subKlass: function (parentKlass, name) {
    var prototype = arguments[2] || {};
    prototype = this.applyMixins(prototype);
    var path  = this.getGlobalPath(name); 
    var klass = path[0][path[1]] = this.createKlass(this.mergePrototype(this.klassPrototype(parentKlass), prototype), name, parentKlass);
    return klass;
  },

  global: function () {
    if (!this._global) {
      try {
        this._global = window;
      } catch (e) {
        this._global = global;
      }
    }
    return this._global;
  },

  log: function () {
    if (this.debug) {
      try {
        return console.log.apply(this.global(), arguments); 
      } catch (e) {
        alert('cannot call console.log for debug:' + e.message);
      } 
    }
  },

  getGlobalPath: function (name) {
    var stack = name.split('.');
    var klassName = stack.pop();
    var klasses = this.buildNameSpace(stack);
    return [klasses, klassName];
  },

  buildNameSpace: function (stack) {
    var klasses = this.global();
    for (var i=0, depth=stack.length; i<depth; i++) {
      if (!klasses[stack[i]]) klasses[stack[i]] = {};
      klasses = klasses[stack[i]];
    }
    return klasses;
  },

  applyMixins: function  (p) {
    if (!p.Mixins || p.Mixins.length == 0) return p;                    
    var prototype = {};
    for (var i=0, m; m=p.Mixins[i]; i++) {
      prototype = this.mergePrototype(prototype, this.klassPrototype(m));
    }
    p.Mixins = null;
    return this.mergePrototype(prototype, p);
  },

  klassPrototype: function (klass) {
    for (var m in klass) {
      if (this.isReserved(m)) continue;
      klass.prototype[m] = klass[m];
    }
    return klass.prototype;
  },

  mergePrototype: function () {
    var p = {}; 
    for (var i=0,len=arguments.length; i<len; i++) {
      var obj = arguments[i];
      if (!obj || typeof obj != 'object') continue;
      for (var k in obj) {
        if (!this.isReserved(k)) p[k] = obj[k];
      }
    }
    return p;
  },

  isReserved: function (attr) {
    if (!this.reservedLookup) {
      this.reservedLookup = {};
      for (var i=0,name; name=this.reservedAttributes[i]; i++) {
        this.reservedLookup[name] = true;
      }
    }
    return this.reservedLookup[attr];
  },

  parsePrototype: function (p) {
    var np = {};
    np.cms = []; // class methods 
    np.cas = {}; // class attributes
    np.ims = []; // instance methods 
    np.ias = {}; // instance attributes
    np.pmsString = '';
    np.cmsString = '';
    np.imsString = '';
    np.Abstract = p.Abstract;
    delete p.Abstract;
    np.Singleton = p.Singleton;

    for (var m in p) {
      if (this.isReserved(m)) continue;
      if (typeof p[m] != 'function') {
         if (m.match(this.cMPrefixRegexp)) {
           np.cas[m] = p[m];
         } else {
           np.ias[m] = p[m];
         }
      } else if (m.match(this.pMPrefixRegexp)) {
        np.pmsString += 'var ' + m + ' = ' + p[m].toString() + ';';
        np.pmsString += m + '._functionName = "' +m+ '";';
      } else if (m.match(this.cMPrefixRegexp)) {
        np.cms.push(m);
        np.cmsString += 'this.' + m + ' = ' + p[m].toString() + ';';
        np.cmsString += 'this.' + m + '._functionName = "' +m+ '";';
      } else {
        np.ims.push(m);
        np.imsString += 'this.' + m + ' = ' + p[m].toString() + ';';
        np.imsString += 'this.' + m + '._functionName = "' +m+ '";';
      }
    }
    return np;
  },

  createKlass: function (p, name, parentKlass) {
    var np = this.parsePrototype(p);
    try {
      eval('var klass=new function(){var self=this;' + this.superMethod + np.pmsString + np.cmsString + '};');
    } catch (e) {
      this.log("Failed to create "+this.klassName+":", e);
    }
    for (var ca in np.cas) {
      klass[ca] = np.cas[ca];
    } 
    klass.classMethods = np.cms;
    klass.instanceMethods = np.ims;
    klass.prototype = p;
    klass.klassName = name;
    klass.parentKlass = parentKlass || Object;
    klass.Singleton = np.Singleton;
     
    if (!np.Abstract){
      if (np.Singleton) {
        klass.$singleton = function () {
          if (!this._singletonInstance) this._singletonInstance = Klass.klassInstance(this); 
          return this._singletonInstance;
        };
      } else {
        klass.$new = function () {
          var instance = Klass.klassInstance(this);
          try {
            if (instance.initialize) instance.initialize.apply(instance, arguments);
          } catch (e) {
            Klass.log("Failed to initialize instance of "+this.klassName+":", e);
          }
          return instance;
        };
      }
    }
    
    klass.$subKlass = function (subKlassName, prototype) {
      return Klass.subKlass(this, subKlassName, prototype);
    }

    klass.$extend = function (prototype) {
      return Klass.extend(this, prototype);
    }

    return klass;
  },

  klassInstance: function (klass) {
    var np = this.parsePrototype(this.klassPrototype(klass));
    try {
      eval('var instance=new function(){var self=this;' + this.superMethod + np.pmsString + np.imsString + '};');
    } catch (e) {
      this.log("Failed to instantiate "+klass.klassName+":", e);
    }
    for (var ia in np.ias) {
      instance[ia] = np.ias[ia];
    } 
    instance.klass = klass;
    return instance;
  }
};
