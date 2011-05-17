Klass.create('Jsapi.Sql.PayloadParser', {
  parseReadPayload: function (res, sqlFields) {
    var rows = [];
    if (res.status != 'ok') {
      throw('response error: '+res.error);
    }

    rows.count = res.response.total_rows;
    var fields = res.response.fields;

    var raws   = res.response.data;
    var fieldsLookup = _getFieldsLookup(fields, sqlFields);
    rows.fields = sqlFields == '*' ? fields : sqlFields;

    for (var i=0,len=raws.length;i<len;i++){
      var raw = raws[i];
      var row = {};
      row.subjectKey = raw[0];
      for (var f in fieldsLookup) {
        row[f] = raw[fieldsLookup[f]];
      }
      rows.push(row);
    }


    return rows;
  },

  _getFieldsLookup: function (fieldsInPayload, sqlFields) {
    // remove subjectKey
    fieldsInPayload.splice(0,1);

    var payloadFieldsLookup = {};
    for (var i=0,len=fieldsInPayload.length; i<len; i++){
      payloadFieldsLookup[fieldsInPayload[i]] = i+1;
    }
    if (sqlFields == '*') return payloadFieldsLookup;

    var lookup = {};
    for (var j=0,l=sqlFields.length; j<l; j++){
      var field = sqlFields[j];
      if (payloadFieldsLookup[field]) {
        lookup[field] = payloadFieldsLookup[field];
      } else {
        throw("sql error: Field '"+field+"' doesn't exist.");
      }
    }
    return lookup;
  }
});
