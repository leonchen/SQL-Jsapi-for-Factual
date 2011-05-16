Klass.create('Jsapi.Sql', {
  apiKey: null,

  initialize: function (apiKey) {
    self.apiKey = apiKey;
    self.parser = Jsapi.Sql.Parser.$new();
    self.ajax = Jsapi.Ajax;
  },

  execute: function (sql, callback) {
    var params = self.parser.parse(sql);
    
    self.resultFields = params.fields;
    delete params.fields;

    params.APIKey = self.apiKey;

    var url = 'http://www.factual.com/api/v2/tables/' + params.table + "/read.jsaml";
    delete params.table;

    self.ajax.$get(url, params, function (res) {
      rows = self.parseResult(res);
      if (callback) callback(rows);
    });
  },

  parseResult: function (res) {
    var rows = [];
    if (res.status != 'ok') {
      console.log(res.error);
      return rows;
    }

    rows.count = res.response.total_rows;
    var raws   = res.response.data;
    var fieldsLookup = _getFieldsLookup(res.response.fields);

    for (var i=0,len=raws.length;i<len;i++){
      var raw = raws[i];
      var row = {};
      for (var f in fieldsLookup) {
        row[f] = raw[fieldsLookup[f]];
      }
      rows.push(row);
    }

    return rows;
  },

  _getFieldsLookup: function (fields) {
    var lookup = {};
    var allFields = false;

    if (self.resultFields == '*') {
      self.resultFields = fields;
      allFields = true;
    }

    for (var i=0,len=self.resultFields.length; i<len; i++){
      var field = self.resultFields[i];
      lookup[field] = allFields ? i : $.inArray(field, fields);
    }
    return lookup;
  }
});
