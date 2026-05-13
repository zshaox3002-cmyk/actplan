/**
 * xlsx-simple.js — 极简 xlsx 构建 + 解析库
 * 仅依赖 ArrayBuffer / Uint8Array，适用于微信小程序环境
 * @module xlsx-simple
 */

'use strict';

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function writeLE(buf, val, byteLen, offset) {
  offset = offset || 0;
  for (var i = 0; i < byteLen; i++) {
    buf[offset + i] = val & 0xFF;
    val = val >>> 8;
  }
}

function crc32(buf) {
  var table = [];
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colLetter(n) {
  var s = '';
  n++;
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function _strToBytes(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) {
      bytes.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
    } else {
      bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
  }
  return new Uint8Array(bytes);
}

// ── xlsx 构建 ──────────────────────────────────────────────────────────────────

function buildSharedStrings(strings) {
  var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  xml += '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  xml += ' count="' + strings.length + '" uniqueCount="' + strings.length + '">';
  for (var i = 0; i < strings.length; i++) {
    xml += '<si><t xml:space="preserve">' + escapeXml(strings[i]) + '</t></si>';
  }
  xml += '</sst>';
  return xml;
}

function buildSheet(rows, validations) {
  var sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  sheetXml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  sheetXml += '<sheetData>';
  for (var r = 0; r < rows.length; r++) {
    sheetXml += '<row r="' + (r + 1) + '">';
    for (var c = 0; c < rows[r].length; c++) {
      var ref = colLetter(c) + (r + 1);
      sheetXml += '<c r="' + ref + '" t="s"><v>' + rows[r][c] + '</v></c>';
    }
    sheetXml += '</row>';
  }
  sheetXml += '</sheetData>';
  if (validations && validations.length > 0) {
    var dataRowCount = rows.length > 1 ? rows.length - 1 : 1000;
    sheetXml += '<dataValidations count="' + validations.length + '">';
    for (var vi = 0; vi < validations.length; vi++) {
      var vld = validations[vi];
      var colL = colLetter(vld.col);
      var sqref = colL + '2:' + colL + (dataRowCount + 1);
      var formula1 = '"' + vld.values.join(',') + '"';
      sheetXml += '<dataValidation type="list" allowBlank="1" showDropDown="0" sqref="' + sqref + '">';
      sheetXml += '<formula1>' + escapeXml(formula1) + '</formula1>';
      sheetXml += '</dataValidation>';
    }
    sheetXml += '</dataValidations>';
  }
  sheetXml += '</worksheet>';
  return sheetXml;
}

function buildZip(entries) {
  var parts = [];
  var cdEntries = [];
  var offset = 0;

  for (var e = 0; e < entries.length; e++) {
    var name      = entries[e].name;
    var data      = entries[e].data;
    var nameBytes = _strToBytes(name);
    var size      = data.length;
    var crc       = crc32(data);

    var localHeader = new Uint8Array(30);
    writeLE(localHeader, 0x04034B50, 4);
    writeLE(localHeader, 20, 2, 4);
    writeLE(localHeader, 0, 2, 6);
    writeLE(localHeader, 0, 2, 8);   // stored
    writeLE(localHeader, 0, 2, 10);
    writeLE(localHeader, 0, 2, 12);
    writeLE(localHeader, crc, 4, 14);
    writeLE(localHeader, size, 4, 18);
    writeLE(localHeader, size, 4, 22);
    writeLE(localHeader, nameBytes.length, 2, 26);
    writeLE(localHeader, 0, 2, 28);

    var cdEntry = new Uint8Array(46);
    writeLE(cdEntry, 0x02014B50, 4);
    writeLE(cdEntry, 20, 2, 4);
    writeLE(cdEntry, 20, 2, 6);
    writeLE(cdEntry, 0, 2, 8);
    writeLE(cdEntry, 0, 2, 10);
    writeLE(cdEntry, 0, 2, 12);
    writeLE(cdEntry, 0, 2, 14);
    writeLE(cdEntry, crc, 4, 16);
    writeLE(cdEntry, size, 4, 20);
    writeLE(cdEntry, size, 4, 24);
    writeLE(cdEntry, nameBytes.length, 2, 28);
    writeLE(cdEntry, 0, 2, 30);
    writeLE(cdEntry, 0, 2, 32);
    writeLE(cdEntry, 0, 2, 34);
    writeLE(cdEntry, 0, 4, 38);
    writeLE(cdEntry, offset, 4, 42);

    parts.push(localHeader, nameBytes, data);
    cdEntries.push(cdEntry, nameBytes);
    offset += localHeader.length + nameBytes.length + size;
  }

  var cdSize = 0;
  for (var i = 0; i < cdEntries.length; i++) cdSize += cdEntries[i].length;
  var eocd = new Uint8Array(22);
  writeLE(eocd, 0x06054B50, 4);
  writeLE(eocd, 0, 2, 4);
  writeLE(eocd, 0, 2, 6);
  writeLE(eocd, entries.length, 2, 8);
  writeLE(eocd, entries.length, 2, 10);
  writeLE(eocd, cdSize, 4, 12);
  writeLE(eocd, offset, 4, 16);
  writeLE(eocd, 0, 2, 20);

  var allParts = parts.concat(cdEntries).concat([eocd]);
  var totalLen = 0;
  for (var i = 0; i < allParts.length; i++) totalLen += allParts[i].length;
  var result = new Uint8Array(totalLen);
  var pos = 0;
  for (var i = 0; i < allParts.length; i++) {
    result.set(allParts[i], pos);
    pos += allParts[i].length;
  }
  return result;
}

/**
 * @param {string[]} headers
 * @param {Array<Object>} rows
 * @param {Array<{col:number, values:string[]}>} [validations]
 * @returns {{buffer: ArrayBuffer}}
 */
function buildXlsx(headers, rows, validations) {
  var strings = headers.slice();
  var sheetRows = [headers.map(function(h, i) { return i; })];
  for (var r = 0; r < rows.length; r++) {
    var rowArr = [];
    for (var c = 0; c < headers.length; c++) {
      var val = String(rows[r][headers[c]] !== undefined ? rows[r][headers[c]] : '');
      var idx = strings.indexOf(val);
      if (idx === -1) { idx = strings.length; strings.push(val); }
      rowArr.push(idx);
    }
    sheetRows.push(rowArr);
  }
  var ssXml  = buildSharedStrings(strings);
  var sheet1 = buildSheet(sheetRows, validations);

  var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  contentTypes += '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
  contentTypes += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
  contentTypes += '<Default Extension="xml" ContentType="application/xml"/>';
  contentTypes += '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
  contentTypes += '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  contentTypes += '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>';
  contentTypes += '</Types>';

  var relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  relsXml += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  relsXml += '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>';
  relsXml += '</Relationships>';

  var wbXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  wbXml += '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
  wbXml += '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>';
  wbXml += '</workbook>';

  var wbRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  wbRelsXml += '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  wbRelsXml += '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>';
  wbRelsXml += '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>';
  wbRelsXml += '</Relationships>';

  var zipData = buildZip([
    { name: '[Content_Types].xml',        data: _strToBytes(contentTypes) },
    { name: '_rels/.rels',                data: _strToBytes(relsXml) },
    { name: 'xl/workbook.xml',            data: _strToBytes(wbXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: _strToBytes(wbRelsXml) },
    { name: 'xl/worksheets/sheet1.xml',   data: _strToBytes(sheet1) },
    { name: 'xl/sharedStrings.xml',       data: _strToBytes(ssXml) }
  ]);

  return { buffer: zipData.buffer };
}

// ── ZIP / XLSX 解析 ────────────────────────────────────────────────────────────

// DEFLATE inflate per RFC 1951 — supports stored, fixed-Huffman, and dynamic-Huffman blocks
function _inflate(data) {
  var src = (data instanceof Uint8Array) ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  var out = [];
  var bp = 0;

  function readBits(n) {
    var v = 0;
    for (var i = 0; i < n; i++) {
      v |= (((src[bp >> 3] >> (bp & 7)) & 1) << i);
      bp++;
    }
    return v;
  }

  function buildTree(lengths) {
    var maxLen = 0;
    for (var i = 0; i < lengths.length; i++) if (lengths[i] > maxLen) maxLen = lengths[i];
    var blCount = [];
    for (var i = 0; i <= maxLen; i++) blCount.push(0);
    for (var i = 0; i < lengths.length; i++) if (lengths[i] > 0) blCount[lengths[i]]++;
    var nextCode = [];
    for (var i = 0; i <= maxLen + 1; i++) nextCode.push(0);
    var code = 0;
    blCount[0] = 0;
    for (var bits = 1; bits <= maxLen; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }
    var table = {};
    for (var n = 0; n < lengths.length; n++) {
      var len = lengths[n];
      if (len === 0) continue;
      var c = nextCode[len];
      nextCode[len]++;
      var key = '';
      for (var b = len - 1; b >= 0; b--) key += (c >> b) & 1;
      table[key] = n;
    }
    return { table: table, maxLen: maxLen };
  }

  function decodeSymbol(tree) {
    var key = '';
    for (var i = 0; i < tree.maxLen; i++) {
      key += readBits(1);
      if (key in tree.table) return tree.table[key];
    }
    return -1;
  }

  function fixedLitLengths() {
    var lens = [];
    for (var i = 0; i <= 143; i++) lens.push(8);
    for (var i = 144; i <= 255; i++) lens.push(9);
    for (var i = 256; i <= 279; i++) lens.push(7);
    for (var i = 280; i <= 287; i++) lens.push(8);
    return lens;
  }
  function fixedDistLengths() {
    var lens = [];
    for (var i = 0; i < 32; i++) lens.push(5);
    return lens;
  }

  var lenExtra  = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  var lenBase   = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  var distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  var distBase  = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];

  function decodeBlock(litTree, distTree) {
    while (true) {
      var sym = decodeSymbol(litTree);
      if (sym < 0 || sym === 256) break;
      if (sym < 256) {
        out.push(sym);
      } else {
        var lenIdx = sym - 257;
        var length = lenBase[lenIdx] + readBits(lenExtra[lenIdx]);
        var distSym = decodeSymbol(distTree);
        var dist = distBase[distSym] + readBits(distExtra[distSym]);
        var pos = out.length - dist;
        for (var i = 0; i < length; i++) out.push(out[pos + i]);
      }
    }
  }

  var bfinal = 0;
  while (!bfinal) {
    bfinal = readBits(1);
    var btype = readBits(2);
    if (btype === 0) {
      bp = (bp + 7) & ~7;
      var len = src[bp >> 3] | (src[(bp >> 3) + 1] << 8);
      bp += 32;
      var start = bp >> 3;
      for (var i = 0; i < len; i++) out.push(src[start + i]);
      bp += len * 8;
    } else if (btype === 1) {
      decodeBlock(buildTree(fixedLitLengths()), buildTree(fixedDistLengths()));
    } else if (btype === 2) {
      var hlit  = readBits(5) + 257;
      var hdist = readBits(5) + 1;
      var hclen = readBits(4) + 4;
      var clOrder = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
      var clLens = [];
      for (var i = 0; i < 19; i++) clLens.push(0);
      for (var i = 0; i < hclen; i++) clLens[clOrder[i]] = readBits(3);
      var clTree = buildTree(clLens);
      var allLens = [];
      while (allLens.length < hlit + hdist) {
        var c = decodeSymbol(clTree);
        if (c < 16) {
          allLens.push(c);
        } else if (c === 16) {
          var rep = readBits(2) + 3;
          var last = allLens[allLens.length - 1];
          for (var i = 0; i < rep; i++) allLens.push(last);
        } else if (c === 17) {
          var rep = readBits(3) + 3;
          for (var i = 0; i < rep; i++) allLens.push(0);
        } else {
          var rep = readBits(7) + 11;
          for (var i = 0; i < rep; i++) allLens.push(0);
        }
      }
      decodeBlock(buildTree(allLens.slice(0, hlit)), buildTree(allLens.slice(hlit)));
    }
  }
  return new Uint8Array(out);
}

function _decodeUtf8(bytes) {
  var s = '';
  var i = 0;
  while (i < bytes.length) {
    var b0 = bytes[i++];
    if (b0 < 0x80) {
      s += String.fromCharCode(b0);
    } else if (b0 < 0xE0) {
      var b1 = bytes[i++];
      s += String.fromCharCode(((b0 & 0x1F) << 6) | (b1 & 0x3F));
    } else if (b0 < 0xF0) {
      var b1 = bytes[i++]; var b2 = bytes[i++];
      s += String.fromCharCode(((b0 & 0x0F) << 12) | ((b1 & 0x3F) << 6) | (b2 & 0x3F));
    } else {
      var b1 = bytes[i++]; var b2 = bytes[i++]; var b3 = bytes[i++];
      var cp = ((b0 & 0x07) << 18) | ((b1 & 0x3F) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F);
      cp -= 0x10000;
      s += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
    }
  }
  return s;
}

function _zipExtract(zip, targetName) {
  var i = 0;
  while (i < zip.length - 4) {
    if (zip[i] === 0x50 && zip[i+1] === 0x4B && zip[i+2] === 0x03 && zip[i+3] === 0x04) {
      var method   = zip[i+8]  | (zip[i+9]  << 8);
      var compSize = zip[i+18] | (zip[i+19] << 8) | (zip[i+20] << 16) | (zip[i+21] << 24);
      var nameLen  = zip[i+26] | (zip[i+27] << 8);
      var extraLen = zip[i+28] | (zip[i+29] << 8);
      var nameStart = i + 30;
      var dataStart = nameStart + nameLen + extraLen;
      var name = _decodeUtf8(zip.subarray(nameStart, nameStart + nameLen));
      if (name === targetName) {
        var raw = zip.subarray(dataStart, dataStart + compSize);
        if (method === 8) return _inflate(raw);
        return raw;
      }
      i = dataStart + compSize;
    } else {
      i++;
    }
  }
  return null;
}

function _xmlTextAll(xml, tag) {
  var results = [];
  var open = '<' + tag;
  var close = '</' + tag + '>';
  var pos = 0;
  while (true) {
    var start = xml.indexOf(open, pos);
    if (start === -1) break;
    var tagEnd = xml.indexOf('>', start);
    if (tagEnd === -1) break;
    if (xml[tagEnd - 1] === '/') {
      pos = tagEnd + 1;
      results.push('');
      continue;
    }
    var end = xml.indexOf(close, tagEnd);
    if (end === -1) break;
    results.push(xml.slice(tagEnd + 1, end));
    pos = end + close.length;
  }
  return results;
}

function _xmlAttr(tag, attr) {
  var pat = attr + '="';
  var start = tag.indexOf(pat);
  if (start === -1) return '';
  var valStart = start + pat.length;
  var valEnd = tag.indexOf('"', valStart);
  return valEnd === -1 ? '' : tag.slice(valStart, valEnd);
}

/**
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {Array<Object>}
 */
function parseXlsx(buffer) {
  var zip = (buffer instanceof Uint8Array) ? buffer : new Uint8Array(buffer);

  var ssBytes = _zipExtract(zip, 'xl/sharedStrings.xml');
  var sharedStrings = [];
  if (ssBytes) {
    var ssXml = _decodeUtf8(ssBytes);
    var siBlocks = _xmlTextAll(ssXml, 'si');
    for (var s = 0; s < siBlocks.length; s++) {
      var tTexts = _xmlTextAll(siBlocks[s], 't');
      sharedStrings.push(tTexts.join(''));
    }
  }

  var sheetBytes = _zipExtract(zip, 'xl/worksheets/sheet1.xml');
  if (!sheetBytes) return [];
  var sheetXml = _decodeUtf8(sheetBytes);

  var rowBlocks = _xmlTextAll(sheetXml, 'row');
  if (rowBlocks.length === 0) return [];

  function parseRow(rowXml) {
    var cells = {};
    var cOpen = '<c ';
    var pos = 0;
    while (true) {
      var cStart = rowXml.indexOf(cOpen, pos);
      if (cStart === -1) break;
      var cTagEnd = rowXml.indexOf('>', cStart);
      if (cTagEnd === -1) break;
      var cTag = rowXml.slice(cStart, cTagEnd + 1);
      var ref = _xmlAttr(cTag, 'r');
      var type = _xmlAttr(cTag, 't');
      var colStr = ref.replace(/[0-9]/g, '');
      var colIdx = 0;
      for (var ci = 0; ci < colStr.length; ci++) {
        colIdx = colIdx * 26 + (colStr.charCodeAt(ci) - 64);
      }
      colIdx--;
      var vStart = rowXml.indexOf('<v>', cTagEnd);
      var vEnd   = rowXml.indexOf('</v>', cTagEnd);
      var val = '';
      if (vStart !== -1 && vEnd !== -1 && vStart < vEnd) {
        var raw = rowXml.slice(vStart + 3, vEnd);
        val = (type === 's') ? (sharedStrings[parseInt(raw, 10)] || '') : raw;
      }
      cells[colIdx] = val;
      pos = vEnd !== -1 ? vEnd : cTagEnd + 1;
    }
    var maxCol = -1;
    var keys = Object.keys(cells);
    for (var k = 0; k < keys.length; k++) {
      var n = parseInt(keys[k], 10);
      if (n > maxCol) maxCol = n;
    }
    var arr = [];
    for (var j = 0; j <= maxCol; j++) {
      arr.push(cells[j] !== undefined ? cells[j] : '');
    }
    return arr;
  }

  var headers = parseRow(rowBlocks[0]);
  var result = [];
  for (var r = 1; r < rowBlocks.length; r++) {
    var vals = parseRow(rowBlocks[r]);
    var obj = {};
    for (var h = 0; h < headers.length; h++) {
      obj[headers[h]] = vals[h] !== undefined ? vals[h] : '';
    }
    result.push(obj);
  }
  return result;
}

module.exports = { buildXlsx: buildXlsx, parseXlsx: parseXlsx };
