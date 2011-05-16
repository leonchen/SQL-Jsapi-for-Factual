Klass.create('Jsapi.Sql.PayloadParser', {
  parseReadPayload: function (res, sqlFields) {
    var rows = [];
    if (res.status != 'ok') {
      console.log(res.error);
      return rows;
    }

    rows.count = res.response.total_rows;
    var raws   = res.response.data;
    var fieldsLookup = _getFieldsLookup(res.response.fields, sqlFields);

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

  _getFieldsLookup: function (fieldsInPayload, sqlFields) {
    var payloadFieldsLookup = {};
    for (var i=0,len=fieldsInPayload.length; i<len; i++){
      payloadFieldsLookup[fieldsInPayload[i]] = i;
    }
    if (sqlFields == '*') return payloadFieldsLookup;

    var lookup = {};
    for (var i=0,len=sqlFields.length; i<len; i++){
      var field = sqlFields[i];
      lookup[field] = payloadFieldsLookup[field];
    }
    return lookup;
  }
});
