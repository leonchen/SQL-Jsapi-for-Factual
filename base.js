Klass.create('Jsapi.Sql', {
  apiKey: null,

  initialize: function (apiKey) {
    self.apiKey = apiKey;
    self.sqlParser = Jsapi.Sql.SqlParser.$new();
    self.payloadParser = Jsapi.Sql.PayloadParser.$new();
    self.ajax = Jsapi.Ajax;
  },

  execute: function (sql, callback) {
    if (/^\s*select/i.test(sql)) {
      self.read(sql, callback);
    } else {
      self.input(sql, callback);
    }
  },

  read: function (sql, callback) {
    var params = self.sqlParser.parseRead(sql);
    
    var sqlFields = params.fields;
    delete params.fields;

    params.APIKey = self.apiKey;

    var url = 'http://www.factual.com/api/v2/tables/' + params.table + "/read.jsaml";
    delete params.table;

    self.ajax.$get(url, params, function (parser, sqlFields, callback) {
      return function (res) {
        var rows = parser.parseReadPayload(res, sqlFields);
        if (callback) callback(rows);
      }
    }(self.payloadParser, sqlFields, callback));
  },

  input: function (sql, callback) {
    var params = self.sqlParser.parseInput(sql);
    params.APIKey = self.apiKey;

    var table = params.table;
    delete params.table;
    var url = 'http://www.factual.com/api/v2/tables/' + table + "/input";

    self.ajax.$get(url, params, function (res) {
      if (res.status == 'ok') {
        self.read("select * from " + table + " where $subject_key='"+res.response.subjectKey+"'", callback);
      } else {
        throw('response error: '+res.error);
      }
    });
  }

});
