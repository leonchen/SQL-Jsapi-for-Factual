Klass.create('Jsapi.Ajax', {
  $get: function (url, params, callBack) {
    params.fromJSAPI = true;
    var ajaxCallBack = _getCallBack(callBack); 
    var paramsString = encodeURIComponent(JSON.stringify(params));
    if (paramsString.length < 1200) {
      return _jsonp(url, params, callBack);
    } else {
      _post(url, params, callBack);
    }
  },

  // TODO handles errors
  _getCallBack: function (callBack) {
    return function (callBack) {
      return function (ret, status) {
        callBack(ret);
      }
    }(callBack);
  },

  _jsonp: function  (url, params, callBack) {
    params = _sanitizeGetParams(params);
    var options = { 
      url: url,
      data: params,
      jsonp: 'jsoncallback',
      dataType: 'jsonp',
      success: callBack,
      error: callBack
    };
    options.jsonpCallback = _getJsonpCallBackName(url, params);
    return $.ajax(options);
  },

  _sanitizeGetParams: function (params) {
    var sortedKeys   = [];
    var sortedParams = [];

    for (var k in params) sortedKeys.push(k);
    sortedKeys = sortedKeys.sort();
    $.each(sortedKeys, function (i, k) {sortedParams.push({ name:k, value:params[k] });});

    return $.param(sortedParams);
  },

  _post: function (url, params, callBack) {
    if (!self.postInitialized) _initializePost();
    var postCallBackName = _getPostCallBackName();

    var postOptions = {};
    postOptions.url = _addUrlParam(url, 'postCallBack', postCallBackName);
    postOptions.params = params;
    postOptions.formName = _getPostFormName(postCallBackName);
    postOptions.iframeName = _getPostIframeName(postCallBackName);
    self.postCallBacks[postCallBackName] = function (data) {
      callBack(data);
    };
    Jsapi.Ajax.Poster.$post(postOptions);
  },

  _addUrlParam: function (uri, key, val) {    
    var chr = uri.indexOf('?') < 0 ? '?' : '&';
    return uri + chr + key + '=' + val; 
  },

  _getPostFormName: function (postCallBackName) {
    return 'factualJsapiPostForm-'+postCallBackName;
  },

  _getPostIframeName: function (postCallBackName) {
    return 'factualJsapiPostIframe-'+postCallBackName;
  },

  _initializePost: function () {
    $.receiveMessage(
      function(e) {
        try {
          var data = JSON.parse(e.data);
          if (data.postCallBack) _postCallBack(data);
        } catch (e) {}
      },
      function () {return true;}
    );
    self.postInitialized = true;
    self.postCallBacks = {};
  },

  _postCallBack: function (data) {
    var callBackName = data.postCallBack;
    if (!self.postCallBacks[callBackName]) return;
    self.postCallBacks[callBackName](data);
    Jsapi.Ajax.Poster.$removeForm(self.getPostFormName(callBackName));
    Jsapi.Ajax.Poster.$removeIframe(self.getPostIframeName(callBackName));
    self.postCallBacks[callBackName] = null;
  },

  _getJsonpCallBackName: function (url, params) {
    var paramString = JSON.stringify(params);
    var jsonpName = 'jsonp_' + MD5(url + paramString);

    if (!window[jsonpName]) return jsonpName;
    // in case if there are same requests happen in one time
    for (var i=0;i<1000;i++) {
      var pName = jsonpName + "_" + i;
      if (!window[pName]) return pName;
    }
    return null;
  },

  _getPostCallBackName: function () {
    var id = new Date().getTime();
    for (var i=0;i<1000;i++) {
      var name = 'post' + id + i;
      if (!self.postCallBacks[name]) return name;
    }
    return null;
  }
});

Klass.create('Jsapi.Ajax.Poster', {
  $post: function (options) {
    var jqForm = _build(options);
    jqForm[0].submit();
  },

  _build: function (options) {
    var jqForm = _getJqForm(options.formName);
    if (!jqForm[0]) jqForm = _buildForm(options.formName);

    jqForm[0].target = options.iframeName;
    jqForm[0].action = options.url;

    var jqIframe = _getJqIframe(options.iframeName);
    if (!jqIframe[0]) jqIframe = _buildIframe(options.iframeName);

    self.buildFormFields(jqForm, options.params);

    return jqForm;
  },

  _getJqForm: function  (name) {
    return $("form[name='"+name+"']");
  },

  _getJqIframe: function (name) {
    return $("iframe[name='"+name+"']");
  },

  _buildForm: function (name) {
    var jqForm = $(document.createElement($.browser.msie ? "<form name='"+name+"' method='post' enctype='multipart/form-data'></form>" : "form"));
    jqForm[0].encoding = 'multipart/form-data';
    jqForm[0].method = 'post';
    jqForm[0].name = name;
    jqForm.css("display", "none");
    $('body').append(jqForm);
    return jqForm;
  },

  _buildIframe: function (name) {
    var jqIframe = $(document.createElement($.browser.msie ? "<iframe name='"+name+"'></iframe>" : "iframe"));
    jqIframe.css("display", "none");
    jqIframe[0].name = name;
    $('body').append(jqIframe);
    return jqIframe;
  },

  _buildFormFields: function (jqForm, params) {
    for (var key in params) {
      var jqField = $(document.createElement($.browser.msie ? '<textarea name="'+key+'" ></textarea>' : "textarea"));
      jqField[0].name = key;
      jqForm.append(jqField);
      jqField.val(params[key]);
    }
  },

  $removeForm: function (name) {
    var jqForm = getJqForm(name);
    if (jqForm[0]) jqForm[0].parentNode.removeChild(jqForm[0]);
  },

  $removeIframe: function (name) {
    var jqIframe = getJqIframe(name);
    if (jqIframe[0]) jqIframe[0].parentNode.removeChild(jqIframe[0]);
  }
});
