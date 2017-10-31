import { CustEvent } from 'chimee-helper';

/* eslint-disable */
class FlvTag {
    constructor() {
        this.tagType = -1;
        this.dataSize = -1;
        this.Timestamp = -1;
        this.StreamID = -1;
        this.body = -1;
        this.time = -1;
        this.arr = [];
        this.size=-1;
    }
    getTime() {
        // this.Timestamp.pop();
        this.arr = [];
        for (let i = 0; i < this.Timestamp.length; i++) {
            this.arr.push((this.Timestamp[i].toString(16).length == 1 ? '0' + this.Timestamp[i].toString(16) : this.Timestamp[i].toString(16)));
        }
        this.arr.pop();
        const time = this.arr.join('');
        this.time = parseInt(time, 16);
        return parseInt(time, 16);
    }
}

/* eslint-disable */
function decodeUTF8(uint8array) {
    const out = [];
    const input = uint8array;
    let i = 0;
    const length = uint8array.length;

    while (i < length) {
        if (input[i] < 0x80) {
            out.push(String.fromCharCode(input[i]));
            ++i;
            continue;
        } else if (input[i] < 0xC0) {
            // fallthrough
        } else if (input[i] < 0xE0) {
            if (checkContinuation(input, i, 1)) {
                const ucs4 = (input[i] & 0x1F) << 6 | (input[i + 1] & 0x3F);
                if (ucs4 >= 0x80) {
                    out.push(String.fromCharCode(ucs4 & 0xFFFF));
                    i += 2;
                    continue;
                }
            }
        } else if (input[i] < 0xF0) {
            if (checkContinuation(input, i, 2)) {
                const ucs4 = (input[i] & 0xF) << 12 | (input[i + 1] & 0x3F) << 6 | input[i + 2] & 0x3F;
                if (ucs4 >= 0x800 && (ucs4 & 0xF800) !== 0xD800) {
                    out.push(String.fromCharCode(ucs4 & 0xFFFF));
                    i += 3;
                    continue;
                }
            }
        } else if (input[i] < 0xF8) {
            if (checkContinuation(input, i, 3)) {
                let ucs4 = (input[i] & 0x7) << 18 | (input[i + 1] & 0x3F) << 12 |
                    (input[i + 2] & 0x3F) << 6 | (input[i + 3] & 0x3F);
                if (ucs4 > 0x10000 && ucs4 < 0x110000) {
                    ucs4 -= 0x10000;
                    out.push(String.fromCharCode((ucs4 >>> 10) | 0xD800));
                    out.push(String.fromCharCode((ucs4 & 0x3FF) | 0xDC00));
                    i += 4;
                    continue;
                }
            }
        }
        out.push(String.fromCharCode(0xFFFD));
        ++i;
    }

    return out.join('');
}

function checkContinuation(uint8array, start, checkLength) {
    let array = uint8array;
    if (start + checkLength < array.length) {
        while (checkLength--) {
            if ((array[++start] & 0xC0) !== 0x80)
                return false;
        }
        return true;
    } else {
        return false;
    }
}

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable */
// Exponential-Golomb buffer decoder
class ExpGolomb {

    constructor(uint8array) {
        this.TAG = this.constructor.name;

        this._buffer = uint8array;
        this._buffer_index = 0;
        this._total_bytes = uint8array.byteLength;
        this._total_bits = uint8array.byteLength * 8;
        this._current_word = 0;
        this._current_word_bits_left = 0;
    }

    destroy() {
        this._buffer = null;
    }

    _fillCurrentWord() {
        const buffer_bytes_left = this._total_bytes - this._buffer_index;
        if (buffer_bytes_left <= 0) { throw new IllegalStateException('ExpGolomb: _fillCurrentWord() but no bytes available'); }

        const bytes_read = Math.min(4, buffer_bytes_left);
        const word = new Uint8Array(4);
        word.set(this._buffer.subarray(this._buffer_index, this._buffer_index + bytes_read));
        this._current_word = new DataView(word.buffer).getUint32(0, false);

        this._buffer_index += bytes_read;
        this._current_word_bits_left = bytes_read * 8;
    }

    readBits(bits) {
        if (bits > 32) { throw new InvalidArgumentException('ExpGolomb: readBits() bits exceeded max 32bits!'); }

        if (bits <= this._current_word_bits_left) {
            const result = this._current_word >>> (32 - bits);
            this._current_word <<= bits;
            this._current_word_bits_left -= bits;
            return result;
        }

        let result = this._current_word_bits_left ? this._current_word : 0;
        result = result >>> (32 - this._current_word_bits_left);
        const bits_need_left = bits - this._current_word_bits_left;

        this._fillCurrentWord();
        const bits_read_next = Math.min(bits_need_left, this._current_word_bits_left);

        const result2 = this._current_word >>> (32 - bits_read_next);
        this._current_word <<= bits_read_next;
        this._current_word_bits_left -= bits_read_next;

        result = (result << bits_read_next) | result2;
        return result;
    }

    readBool() {
        return this.readBits(1) === 1;
    }

    readByte() {
        return this.readBits(8);
    }

    _skipLeadingZero() {
        let zero_count;
        for (zero_count = 0; zero_count < this._current_word_bits_left; zero_count++) {
            if ((this._current_word & (0x80000000 >>> zero_count)) !== 0) {
                this._current_word <<= zero_count;
                this._current_word_bits_left -= zero_count;
                return zero_count;
            }
        }
        this._fillCurrentWord();
        return zero_count + this._skipLeadingZero();
    }

    readUEG() { // unsigned exponential golomb
        const leading_zeros = this._skipLeadingZero();
        return this.readBits(leading_zeros + 1) - 1;
    }

    readSEG() { // signed exponential golomb
        const value = this.readUEG();
        if (value & 0x01) {
            return (value + 1) >>> 1;
        } else {
            return -1 * (value >>> 1);
        }
    }

}

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable */
class SPSParser {

    static _ebsp2rbsp(uint8array) {
        const src = uint8array;
        const src_length = src.byteLength;
        const dst = new Uint8Array(src_length);
        let dst_idx = 0;

        for (let i = 0; i < src_length; i++) {
            if (i >= 2) {
                // Unescape: Skip 0x03 after 00 00
                if (src[i] === 0x03 && src[i - 1] === 0x00 && src[i - 2] === 0x00) {
                    continue;
                }
            }
            dst[dst_idx] = src[i];
            dst_idx++;
        }

        return new Uint8Array(dst.buffer, 0, dst_idx);
    }

    static parseSPS(uint8array) {
        const rbsp = SPSParser._ebsp2rbsp(uint8array);
        let gb = new ExpGolomb(rbsp);

        gb.readByte();
        const profile_idc = gb.readByte(); // profile_idc
        gb.readByte(); // constraint_set_flags[5] + reserved_zero[3]
        const level_idc = gb.readByte(); // level_idc
        gb.readUEG(); // seq_parameter_set_id

        const profile_string = SPSParser.getProfileString(profile_idc);
        const level_string = SPSParser.getLevelString(level_idc);
        let chroma_format_idc = 1;
        let chroma_format = 420;
        const chroma_format_table = [0, 420, 422, 444];
        let bit_depth = 8;

        if (profile_idc === 100 || profile_idc === 110 || profile_idc === 122 ||
            profile_idc === 244 || profile_idc === 44 || profile_idc === 83 ||
            profile_idc === 86 || profile_idc === 118 || profile_idc === 128 ||
            profile_idc === 138 || profile_idc === 144) {

            chroma_format_idc = gb.readUEG();
            if (chroma_format_idc === 3) {
                gb.readBits(1); // separate_colour_plane_flag
            }
            if (chroma_format_idc <= 3) {
                chroma_format = chroma_format_table[chroma_format_idc];
            }

            bit_depth = gb.readUEG() + 8; // bit_depth_luma_minus8
            gb.readUEG(); // bit_depth_chroma_minus8
            gb.readBits(1); // qpprime_y_zero_transform_bypass_flag
            if (gb.readBool()) { // seq_scaling_matrix_present_flag
                const scaling_list_count = (chroma_format_idc !== 3) ? 8 : 12;
                for (let i = 0; i < scaling_list_count; i++) {
                    if (gb.readBool()) { // seq_scaling_list_present_flag
                        if (i < 6) {
                            SPSParser._skipScalingList(gb, 16);
                        } else {
                            SPSParser._skipScalingList(gb, 64);
                        }
                    }
                }
            }
        }
        gb.readUEG(); // log2_max_frame_num_minus4
        const pic_order_cnt_type = gb.readUEG();
        if (pic_order_cnt_type === 0) {
            gb.readUEG(); // log2_max_pic_order_cnt_lsb_minus_4
        } else if (pic_order_cnt_type === 1) {
            gb.readBits(1); // delta_pic_order_always_zero_flag
            gb.readSEG(); // offset_for_non_ref_pic
            gb.readSEG(); // offset_for_top_to_bottom_field
            const num_ref_frames_in_pic_order_cnt_cycle = gb.readUEG();
            for (let i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i++) {
                gb.readSEG(); // offset_for_ref_frame
            }
        }
        gb.readUEG(); // max_num_ref_frames
        gb.readBits(1); // gaps_in_frame_num_value_allowed_flag

        const pic_width_in_mbs_minus1 = gb.readUEG();
        const pic_height_in_map_units_minus1 = gb.readUEG();

        const frame_mbs_only_flag = gb.readBits(1);
        if (frame_mbs_only_flag === 0) {
            gb.readBits(1); // mb_adaptive_frame_field_flag
        }
        gb.readBits(1); // direct_8x8_inference_flag

        let frame_crop_left_offset = 0;
        let frame_crop_right_offset = 0;
        let frame_crop_top_offset = 0;
        let frame_crop_bottom_offset = 0;

        const frame_cropping_flag = gb.readBool();
        if (frame_cropping_flag) {
            frame_crop_left_offset = gb.readUEG();
            frame_crop_right_offset = gb.readUEG();
            frame_crop_top_offset = gb.readUEG();
            frame_crop_bottom_offset = gb.readUEG();
        }

        let sar_width = 1,
            sar_height = 1;
        let fps = 0,
            fps_fixed = true,
            fps_num = 0,
            fps_den = 0;

        const vui_parameters_present_flag = gb.readBool();
        if (vui_parameters_present_flag) {
            if (gb.readBool()) { // aspect_ratio_info_present_flag
                const aspect_ratio_idc = gb.readByte();
                const sar_w_table = [1, 12, 10, 16, 40, 24, 20, 32, 80, 18, 15, 64, 160, 4, 3, 2];
                const sar_h_table = [1, 11, 11, 11, 33, 11, 11, 11, 33, 11, 11, 33, 99, 3, 2, 1];

                if (aspect_ratio_idc > 0 && aspect_ratio_idc < 16) {
                    sar_width = sar_w_table[aspect_ratio_idc - 1];
                    sar_height = sar_h_table[aspect_ratio_idc - 1];
                } else if (aspect_ratio_idc === 255) {
                    sar_width = gb.readByte() << 8 | gb.readByte();
                    sar_height = gb.readByte() << 8 | gb.readByte();
                }
            }

            if (gb.readBool()) { // overscan_info_present_flag
                gb.readBool(); // overscan_appropriate_flag
            }
            if (gb.readBool()) { // video_signal_type_present_flag
                gb.readBits(4); // video_format & video_full_range_flag
                if (gb.readBool()) { // colour_description_present_flag
                    gb.readBits(24); // colour_primaries & transfer_characteristics & matrix_coefficients
                }
            }
            if (gb.readBool()) { // chroma_loc_info_present_flag
                gb.readUEG(); // chroma_sample_loc_type_top_field
                gb.readUEG(); // chroma_sample_loc_type_bottom_field
            }
            if (gb.readBool()) { // timing_info_present_flag
                const num_units_in_tick = gb.readBits(32);
                const time_scale = gb.readBits(32);
                fps_fixed = gb.readBool(); // fixed_frame_rate_flag

                fps_num = time_scale;
                fps_den = num_units_in_tick * 2;
                fps = fps_num / fps_den;
            }
        }

        let sarScale = 1;
        if (sar_width !== 1 || sar_height !== 1) {
            sarScale = sar_width / sar_height;
        }

        let crop_unit_x = 0,
            crop_unit_y = 0;
        if (chroma_format_idc === 0) {
            crop_unit_x = 1;
            crop_unit_y = 2 - frame_mbs_only_flag;
        } else {
            const sub_wc = (chroma_format_idc === 3) ? 1 : 2;
            const sub_hc = (chroma_format_idc === 1) ? 2 : 1;
            crop_unit_x = sub_wc;
            crop_unit_y = sub_hc * (2 - frame_mbs_only_flag);
        }

        let codec_width = (pic_width_in_mbs_minus1 + 1) * 16;
        let codec_height = (2 - frame_mbs_only_flag) * ((pic_height_in_map_units_minus1 + 1) * 16);

        codec_width -= (frame_crop_left_offset + frame_crop_right_offset) * crop_unit_x;
        codec_height -= (frame_crop_top_offset + frame_crop_bottom_offset) * crop_unit_y;

        const present_width = Math.ceil(codec_width * sarScale);

        gb.destroy();
        gb = null;

        return {
            profile_string, // baseline, high, high10, ...
            level_string, // 3, 3.1, 4, 4.1, 5, 5.1, ...
            bit_depth, // 8bit, 10bit, ...
            chroma_format, // 4:2:0, 4:2:2, ...
            chroma_format_string: SPSParser.getChromaFormatString(chroma_format),

            frame_rate: {
                fixed: fps_fixed,
                fps,
                fps_den,
                fps_num
            },

            sar_ratio: {
                width: sar_width,
                height: sar_height
            },

            codec_size: {
                width: codec_width,
                height: codec_height
            },

            present_size: {
                width: present_width,
                height: codec_height
            }
        };
    }

    static _skipScalingList(gb, count) {
        let last_scale = 8,
            next_scale = 8;
        let delta_scale = 0;
        for (let i = 0; i < count; i++) {
            if (next_scale !== 0) {
                delta_scale = gb.readSEG();
                next_scale = (last_scale + delta_scale + 256) % 256;
            }
            last_scale = (next_scale === 0) ? last_scale : next_scale;
        }
    }

    static getProfileString(profile_idc) {
        switch (profile_idc) {
            case 66:
                return 'Baseline';
            case 77:
                return 'Main';
            case 88:
                return 'Extended';
            case 100:
                return 'High';
            case 110:
                return 'High10';
            case 122:
                return 'High422';
            case 244:
                return 'High444';
            default:
                return 'Unknown';
        }
    }

    static getLevelString(level_idc) {
        return (level_idc / 10).toFixed(1);
    }

    static getChromaFormatString(chroma) {
        switch (chroma) {
            case 420:
                return '4:2:0';
            case 422:
                return '4:2:2';
            case 444:
                return '4:4:4';
            default:
                return 'Unknown';
        }
    }

}

/* eslint-disable */
const le = (function() {
    const buf = new ArrayBuffer(2);
    (new DataView(buf)).setInt16(0, 256, true); // little-endian write
    return (new Int16Array(buf))[0] === 256; // platform-spec read, if equal then LE
})();
class flvDemux {

    constructor() {

    }
    static parseObject(arrayBuffer, dataOffset, dataSize) {

        const name = flvDemux.parseString(arrayBuffer, dataOffset, dataSize);
        const value = flvDemux.parseScript(arrayBuffer, dataOffset + name.size);
        const isObjectEnd = value.objectEnd;

        return {
            data: {
                name: name.data,
                value: value.data
            },
            size: value.size,
            objectEnd: isObjectEnd
        };
    }

    static parseVariable(arrayBuffer, dataOffset, dataSize) {
        return flvDemux.parseObject(arrayBuffer, dataOffset, dataSize);
    }
    static parseLongString(arrayBuffer, dataOffset, dataSize) {

        const v = new DataView(arrayBuffer, dataOffset);
        const length = v.getUint32(0, !le);

        let str;
        if (length > 0) {
            str = decodeUTF8(new Uint8Array(arrayBuffer, dataOffset + 4, length));
        } else {
            str = '';
        }

        return {
            data: str,
            size: 4 + length
        };
    }
    static parseDate(arrayBuffer, dataOffset, dataSize) {

        const v = new DataView(arrayBuffer, dataOffset);
        let timestamp = v.getFloat64(0, !le);
        const localTimeOffset = v.getInt16(8, !le);
        timestamp += localTimeOffset * 60 * 1000; // get UTC time

        return {
            data: new Date(timestamp),
            size: 8 + 2
        };
    }
    static parseString(arrayBuffer, dataOffset, dataSize) {
        const v = new DataView(arrayBuffer, dataOffset);
        const length = v.getUint16(0, !le);
        let str;
        if (length > 0) {
            str = decodeUTF8(new Uint8Array(arrayBuffer, dataOffset + 2, length));
        } else {
            str = '';
        }
        return {
            data: str,
            size: 2 + length
        };
    }

    /**
     * 解析metadata
     */
    static parseMetadata(arr) {
        const name = flvDemux.parseScript(arr, 0);
        const value = flvDemux.parseScript(arr, name.size, arr.length - name.size);
        // return {}
        const data = {};
        data[name.data] = value.data;
        return data;
    }

    static parseScript(arr, offset, dataSize) {
        let dataOffset = offset;
        const object = {};
        const uint8 = new Uint8Array(arr);
        const buffer = uint8.buffer;
        const dv = new DataView(buffer, 0, dataSize);
        let value = null;
        let objectEnd = false;
        const type = (dv.getUint8(dataOffset));
        dataOffset += 1;

        switch (type) {
            case 0: // Number(Double) type
                value = dv.getFloat64(dataOffset, !le);
                dataOffset += 8;
                break;
            case 1:
                { // Boolean type
                    const b = dv.getUint8(dataOffset);
                    value = !!b;
                    dataOffset += 1;
                    break;
                }
            case 2:
                { // String type
                    // dataOffset += 1;
                    const amfstr = flvDemux.parseString(buffer, dataOffset);
                    value = amfstr.data;
                    dataOffset += amfstr.size;
                    break;
                }
            case 3:

                { // Object(s) type
                    value = {};
                    let terminal = 0; // workaround for malformed Objects which has missing ScriptDataObjectEnd
                    if ((dv.getUint32(dataSize - 4, !le) & 0x00FFFFFF) === 9) {
                        terminal = 3;
                    }
                    while (dataOffset < dataSize - 4) { // 4 === type(UI8) + ScriptDataObjectEnd(UI24)
                        const amfobj = flvDemux.parseObject(buffer, dataOffset, dataSize - offset - terminal);

                        if (amfobj.objectEnd) { break; }
                        value[amfobj.data.name] = amfobj.data.value;
                        // dataOffset += amfobj.size;
                        dataOffset = amfobj.size;
                    }
                    if (dataOffset <= dataSize - 3) {
                        const marker = v.getUint32(dataOffset - 1, !le) & 0x00FFFFFF;
                        if (marker === 9) {
                            dataOffset += 3;
                        }
                    }
                    break;
                }
            case 8:
                { // ECMA array type (Mixed array)
                    value = {};
                    // dataOffset += 1;
                    dataOffset += 4; // ECMAArrayLength(UI32)
                    let terminal = 0; // workaround for malformed MixedArrays which has missing ScriptDataObjectEnd
                    if ((dv.getUint32(dataSize - 4, !le) & 0x00FFFFFF) === 9) {
                        terminal = 3;
                    }
                    while (dataOffset < dataSize - 8) { // 8 === type(UI8) + ECMAArrayLength(UI32) + ScriptDataVariableEnd(UI24)
                        const amfvar = flvDemux.parseVariable(buffer, dataOffset);

                        if (amfvar.objectEnd) { break; }
                        value[amfvar.data.name] = amfvar.data.value;
                        dataOffset = amfvar.size;
                    }
                    if (dataOffset <= dataSize - 3) {
                        const marker = dv.getUint32(dataOffset - 1, !le) & 0x00FFFFFF;
                        if (marker === 9) {
                            dataOffset += 3;
                        }
                    }
                    break;
                }
            case 9: // ScriptDataObjectEnd
                value = undefined;
                dataOffset = 1;
                objectEnd = true;
                break;
            case 10:
                { // Strict array type
                    // ScriptDataValue[n]. NOTE: according to video_file_format_spec_v10_1.pdf
                    value = [];
                    const strictArrayLength = dv.getUint32(dataOffset, !le);
                    dataOffset += 4;
                    for (let i = 0; i < strictArrayLength; i++) {
                        const val = flvDemux.parseScript(buffer, dataOffset);
                        value.push(val.data);
                        dataOffset = val.size;
                    }
                    break;
                }
            case 11:
                { // Date type
                    const date = flvDemux.parseDate(buffer, dataOffset + 1, dataSize - 1);
                    value = date.data;
                    dataOffset += date.size;
                    break;
                }
            case 12:
                { // Long string type
                    const amfLongStr = flvDemux.parseString(buffer, dataOffset + 1, dataSize - 1);
                    value = amfLongStr.data;
                    dataOffset += amfLongStr.size;
                    break;
                }
            default:
                // ignore and skip
                dataOffset = dataSize;
                console.log('AMF', 'Unsupported AMF value type ' + type);
        }
        return {
            data: value,
            size: dataOffset,
        };
    }
}

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable */
class MediaInfo {

    constructor() {
        this.mimeType = null;
        this.duration = null;

        this.hasAudio = null;
        this.hasVideo = null;
        this.audioCodec = null;
        this.videoCodec = null;
        this.audioDataRate = null;
        this.videoDataRate = null;

        this.audioSampleRate = null;
        this.audioChannelCount = null;

        this.width = null;
        this.height = null;
        this.fps = null;
        this.profile = null;
        this.level = null;
        this.chromaFormat = null;
        this.sarNum = null;
        this.sarDen = null;

        this.metadata = null;
        this.segments = null; // MediaInfo[]
        this.segmentCount = null;
        this.hasKeyframesIndex = null;
        this.keyframesIndex = null;
    }

    isComplete() {
        const audioInfoComplete = (this.hasAudio === false) ||
            (this.hasAudio === true &&
                this.audioCodec != null &&
                this.audioSampleRate != null &&
                this.audioChannelCount != null);

        const videoInfoComplete = (this.hasVideo === false) ||
            (this.hasVideo === true &&
                this.videoCodec != null &&
                this.width != null &&
                this.height != null &&
                this.fps != null &&
                this.profile != null &&
                this.level != null &&
                this.chromaFormat != null &&
                this.sarNum != null &&
                this.sarDen != null);

        // keyframesIndex may not be present
        return this.mimeType != null &&
            this.duration != null &&
            this.metadata != null &&
            this.hasKeyframesIndex != null &&
            audioInfoComplete &&
            videoInfoComplete;
    }

    isSeekable() {
        return this.hasKeyframesIndex === true;
    }
}

class Error {
    constructor (type) {
        this.type = type;
    }
}

/* eslint-disable */
class tagDemux {
    constructor() {
        this.TAG = this.constructor.name;

        this._config = {};

        this._onError = null;
        this._onMediaInfo = null;
        this._onTrackMetadata = null;
        this._onDataAvailable = null;

        this._dataOffset = 0;
        this._firstParse = true;
        this._dispatch = false;

        this._hasAudio = false;
        this._hasVideo = false;

        this._audioInitialMetadataDispatched = false;
        this._videoInitialMetadataDispatched = false;

        this._mediaInfo = new MediaInfo();
        this._mediaInfo.hasAudio = this._hasAudio;
        this._mediaInfo.hasVideo = this._hasVideo;
        this._metadata = null;
        this._audioMetadata = null;
        this._videoMetadata = null;

        this._naluLengthSize = 4;
        this._timestampBase = 0; // int32, in milliseconds
        this._timescale = 1000;
        this._duration = 0; // int32, in milliseconds
        this._durationOverrided = false;
        this._referenceFrameRate = {
            fixed: true,
            fps: 23.976,
            fps_num: 23976,
            fps_den: 1000
        };

        this._videoTrack = { type: 'video', id: 1, sequenceNumber: 0, addcoefficient: 2, samples: [], length: 0 };
        this._audioTrack = { type: 'audio', id: 2, sequenceNumber: 0, addcoefficient: 2, samples: [], length: 0 };

        this._littleEndian = (function() {
            const buf = new ArrayBuffer(2);
            (new DataView(buf)).setInt16(0, 256, true); // little-endian write
            return (new Int16Array(buf))[0] === 256; // platform-spec read, if equal then LE
        })();
    }
    set hasAudio(s){
        this._mediaInfo.hasAudio = this._hasAudio=s;
    }
    set hasVideo(s){
        this._mediaInfo.hasVideo = this._hasVideo=s;
    }
    onMediaInfo(callback) {
        this._onMediaInfo = callback;
    }
    parseMetadata(arr) {
        const data = flvDemux.parseMetadata(arr);
        this._parseScriptData(data);
        // console.log(this._mediaInfo, this._mediaInfo.isComplete());
    }
    _parseScriptData(obj) {
        const scriptData = obj;

        if (scriptData.hasOwnProperty('onMetaData')) {
            if (this._metadata) {
                // console.log(this.TAG, 'Found another onMetaData tag!');
            }
            this._metadata = scriptData;
            const onMetaData = this._metadata.onMetaData;

            if (typeof onMetaData.hasAudio === 'boolean') { // hasAudio
                this._hasAudio = onMetaData.hasAudio;
                this._mediaInfo.hasAudio = this._hasAudio;
            }
            if (typeof onMetaData.hasVideo === 'boolean') { // hasVideo
                this._hasVideo = onMetaData.hasVideo;
                this._mediaInfo.hasVideo = this._hasVideo;
            }
            if (typeof onMetaData.audiodatarate === 'number') { // audiodatarate
                this._mediaInfo.audioDataRate = onMetaData.audiodatarate;
            }
            if (typeof onMetaData.videodatarate === 'number') { // videodatarate
                this._mediaInfo.videoDataRate = onMetaData.videodatarate;
            }
            if (typeof onMetaData.width === 'number') { // width
                this._mediaInfo.width = onMetaData.width;
            }
            if (typeof onMetaData.height === 'number') { // height
                this._mediaInfo.height = onMetaData.height;
            }
            if (typeof onMetaData.duration === 'number') { // duration
                if (!this._durationOverrided) {
                    const duration = Math.floor(onMetaData.duration * this._timescale);
                    this._duration = duration;
                    this._mediaInfo.duration = duration;
                }
            } else {
                this._mediaInfo.duration = 0;
            }
            if (typeof onMetaData.framerate === 'number') { // framerate
                const fps_num = Math.floor(onMetaData.framerate * 1000);
                if (fps_num > 0) {
                    const fps = fps_num / 1000;
                    this._referenceFrameRate.fixed = true;
                    this._referenceFrameRate.fps = fps;
                    this._referenceFrameRate.fps_num = fps_num;
                    this._referenceFrameRate.fps_den = 1000;
                    this._mediaInfo.fps = fps;
                }
            }
            if (typeof onMetaData.keyframes === 'object') { // keyframes
                this._mediaInfo.hasKeyframesIndex = true;
                const keyframes = onMetaData.keyframes;
                keyframes.times = onMetaData.times;
                keyframes.filepositions = onMetaData.filepositions;
                this._mediaInfo.keyframesIndex = this._parseKeyframesIndex(keyframes);
                onMetaData.keyframes = null; // keyframes has been extracted, remove it
            } else {
                this._mediaInfo.hasKeyframesIndex = false;
            }
            this._dispatch = false;
            this._mediaInfo.metadata = onMetaData;
            console.log(this.TAG, 'Parsed onMetaData');
            // if (this._mediaInfo.isComplete()) {
            // this._onMediaInfo(this._mediaInfo);
            // }
            return this._mediaInfo;
        }
    }

    _parseKeyframesIndex(keyframes) {
        const times = [];
        const filepositions = [];

        // ignore first keyframe which is actually AVC Sequence Header (AVCDecoderConfigurationRecord)
        for (let i = 1; i < keyframes.times.length; i++) {
            const time = this._timestampBase + Math.floor(keyframes.times[i] * 1000);
            times.push(time);
            filepositions.push(keyframes.filepositions[i]);
        }

        return {
            times,
            filepositions
        };
    }

    /**
     * 传入tags输出moof和mdat
     *
     * @param {any} tags
     *
     * @memberof tagDemux
     */
    moofTag(tags) {

        for (let i = 0; i < tags.length; i++) {
            this._dispatch = true;
            this.parseChunks(tags[i]);
            // console.log("tagTimestamp", tags[i].getTime(), tags[i]);
        }
        if (this._isInitialMetadataDispatched()) {
            if (this._dispatch && (this._audioTrack.length || this._videoTrack.length)) {
                this._onDataAvailable(this._audioTrack, this._videoTrack);
            }
        }
    }

    parseChunks(flvtag) {

        switch (flvtag.tagType) {
            case 8: // Audio
                this._parseAudioData(flvtag.body.buffer, 0, flvtag.body.length, flvtag.getTime());
                break;
            case 9: // Video
                this._parseVideoData(flvtag.body.buffer, 0, flvtag.body.length, flvtag.getTime(), 0);
                break;
            case 18: // ScriptDataObject
                this.parseMetadata(flvtag.body);
                break;
        }
    }

    _parseVideoData(arrayBuffer, dataOffset, dataSize, tagTimestamp, tagPosition) {
        if (tagTimestamp == this._timestampBase && this._timestampBase != 0) {
            throw new Error(tagTimestamp, this._timestampBase, '夭寿啦这个视频不是从0开始');
            // this.timestampBase(0);
        }
        if (dataSize <= 1) {
            console.log(this.TAG, 'Flv: Invalid video packet, missing VideoData payload!');
            return;
        }
        // 获取 video tag body 第一字节
        const spec = (new Uint8Array(arrayBuffer, dataOffset, dataSize))[0];
        // 获取是否是关键帧
        const frameType = (spec & 240) >>> 4;
        // 获取编码格式
        const codecId = spec & 15;

        if (codecId !== 7) {
            if(this._onError)
            this._onError(`Flv: Unsupported codec in video frame: ${codecId}`);
            return;
        }

        this._parseAVCVideoPacket(arrayBuffer, dataOffset + 1, dataSize - 1, tagTimestamp, tagPosition, frameType);
    }

    _parseAVCVideoPacket(arrayBuffer, dataOffset, dataSize, tagTimestamp, tagPosition, frameType) {

        if (dataSize < 4) {
            console.log(this.TAG, 'Flv: Invalid AVC packet, missing AVCPacketType or/and CompositionTime');
            return;
        }

        const le = this._littleEndian;
        // 获取 video tag body 第2字节到结尾
        const v = new DataView(arrayBuffer, dataOffset, dataSize);

        // IF CodecID == 7  AVCPacketType
        // 0 = AVC sequence header
        // 1 = AVC NALU
        // 2 = AVC end of sequence (lower level NALU sequence ender is not required or supported)
        const packetType = v.getUint8(0);
        // 3字节
        // IF AVCPacketType == 1
        //  Composition time offset
        // ELSE
        //  0
        const cts = v.getUint32(0, !le) & 0x00FFFFFF;

        // IF AVCPacketType == 0 AVCDecoderConfigurationRecord（AVC sequence header）
        // IF AVCPacketType == 1 One or more NALUs (Full frames are required)

        /**
         *AVCDecoderConfigurationRecord.包含着是H.264解码相关比较重要的sps和pps信息，
         *再给AVC解码器送数据 流之前一定要把sps和pps信息送出，否则的话解码器不能正常解码。
         *而且在解码器stop之后再次start之前，如seek、快进快退状态切换等，
         *都 需要重新送一遍sps和pps的信息.AVCDecoderConfigurationRecord在FLV文件中一般情况也是出现1次，
         *也就是第一个 video tag.
         */
        if (packetType === 0) { // AVCDecoderConfigurationRecord
            this._parseAVCDecoderConfigurationRecord(arrayBuffer, dataOffset + 4, dataSize - 4);
        } else if (packetType === 1) { // One or more Nalus
            this._parseAVCVideoData(arrayBuffer, dataOffset + 4, dataSize - 4, tagTimestamp, tagPosition, frameType, cts);
        } else if (packetType === 2) {
            // empty, AVC end of sequence
        } else {
            this._onError(`Flv: Invalid video packet type ${packetType}`);
            return;
        }
    }

    /**
     * AVC 初始化
     */
    _parseAVCDecoderConfigurationRecord(arrayBuffer, dataOffset, dataSize) {
        if (dataSize < 7) {
            console.log(this.TAG, 'Flv: Invalid AVCDecoderConfigurationRecord, lack of data!');
            return;
        }

        let meta = this._videoMetadata;
        const track = this._videoTrack;
        const le = this._littleEndian;
        const v = new DataView(arrayBuffer, dataOffset, dataSize);

        if (!meta) {
            meta = this._videoMetadata = {};
            meta.type = 'video';
            meta.id = track.id;
            meta.timescale = this._timescale;
            meta.duration = this._duration;
        } else {
            if (typeof meta.avcc !== 'undefined') {
                console.log(this.TAG, 'Found another AVCDecoderConfigurationRecord!');
            }
        }

        const version = v.getUint8(0); // configurationVersion
        const avcProfile = v.getUint8(1); // avcProfileIndication
        const profileCompatibility = v.getUint8(2); // profile_compatibility
        const avcLevel = v.getUint8(3); // AVCLevelIndication

        if (version !== 1 || avcProfile === 0) {
            this._onError(DemuxErrors.FORMAT_ERROR, 'Flv: Invalid AVCDecoderConfigurationRecord');
            return;
        }

        this._naluLengthSize = (v.getUint8(4) & 3) + 1; // lengthSizeMinusOne
        if (this._naluLengthSize !== 3 && this._naluLengthSize !== 4) { // holy shit!!!
            this._onError(DemuxErrors.FORMAT_ERROR, `Flv: Strange NaluLengthSizeMinusOne: ${this._naluLengthSize - 1}`);
            return;
        }

        const spsCount = v.getUint8(5) & 31; // numOfSequenceParameterSets
        if (spsCount === 0 || spsCount > 1) {
            this._onError(DemuxErrors.FORMAT_ERROR, `Flv: Invalid H264 SPS count: ${spsCount}`);
            return;
        }

        let offset = 6;

        for (let i = 0; i < spsCount; i++) {
            const len = v.getUint16(offset, !le); // sequenceParameterSetLength
            offset += 2;

            if (len === 0) {
                continue;
            }

            // Notice: Nalu without startcode header (00 00 00 01)
            const sps = new Uint8Array(arrayBuffer, dataOffset + offset, len);
            offset += len;

            const config = SPSParser.parseSPS(sps);
            meta.codecWidth = config.codec_size.width;
            meta.codecHeight = config.codec_size.height;
            meta.presentWidth = config.present_size.width;
            meta.presentHeight = config.present_size.height;
            meta.config=config;
            meta.profile = config.profile_string;
            meta.level = config.level_string;
            meta.bitDepth = config.bit_depth;
            meta.chromaFormat = config.chroma_format;
            meta.sarRatio = config.sar_ratio;
            meta.frameRate = config.frame_rate;

            if (config.frame_rate.fixed === false ||
                config.frame_rate.fps_num === 0 ||
                config.frame_rate.fps_den === 0) {
                meta.frameRate = this._referenceFrameRate;
            }

            const fps_den = meta.frameRate.fps_den;
            const fps_num = meta.frameRate.fps_num;
            meta.refSampleDuration = Math.floor(meta.timescale * (fps_den / fps_num));

            const codecArray = sps.subarray(1, 4);
            let codecString = 'avc1.';
            for (let j = 0; j < 3; j++) {
                let h = codecArray[j].toString(16);
                if (h.length < 2) {
                    h = '0' + h;
                }
                codecString += h;
            }
            meta.codec = codecString;

            const mi = this._mediaInfo;
            mi.width = meta.codecWidth;
            mi.height = meta.codecHeight;
            mi.fps = meta.frameRate.fps;
            mi.profile = meta.profile;
            mi.level = meta.level;
            mi.chromaFormat = config.chroma_format_string;
            mi.sarNum = meta.sarRatio.width;
            mi.sarDen = meta.sarRatio.height;
            mi.videoCodec = codecString;
            mi.meta=meta;
            if (mi.hasAudio) {
                if (mi.audioCodec != null) {
                    mi.mimeType = 'video/x-flv; codecs="' + mi.videoCodec + ',' + mi.audioCodec + '"';
                }
            } else {
                mi.mimeType = 'video/x-flv; codecs="' + mi.videoCodec + '"';
            }
            if (mi.isComplete()) {
                this._onMediaInfo(mi);
            }
        }

        const ppsCount = v.getUint8(offset); // numOfPictureParameterSets
        if (ppsCount === 0 || ppsCount > 1) {
            this._onError(DemuxErrors.FORMAT_ERROR, `Flv: Invalid H264 PPS count: ${ppsCount}`);
            return;
        }

        offset++;

        for (let i = 0; i < ppsCount; i++) {
            const len = v.getUint16(offset, !le); // pictureParameterSetLength
            offset += 2;

            if (len === 0) {
                continue;
            }

            // pps is useless for extracting video information
            offset += len;
        }

        meta.avcc = new Uint8Array(dataSize);
        meta.avcc.set(new Uint8Array(arrayBuffer, dataOffset, dataSize), 0);
        console.log(this.TAG, 'Parsed AVCDecoderConfigurationRecord');

        if (this._isInitialMetadataDispatched()) {
            // flush parsed frames
            if (this._dispatch && (this._audioTrack.length || this._videoTrack.length)) {
                this._onDataAvailable(this._audioTrack, this._videoTrack);
            }
        } else {
            this._videoInitialMetadataDispatched = true;
        }
        // notify new metadata
        this._dispatch = false;
        // if (this._onTrackMetadata) {
        //     this._onTrackMetadata.call(null, meta);
        // }

        this._onTrackMetadata('video', meta);
    }
    
    timestampBase(i) {
        this._timestampBase = i;
    }

    /**
     * 普通的AVC 片段
     */
    _parseAVCVideoData(arrayBuffer, dataOffset, dataSize, tagTimestamp, tagPosition, frameType, cts) {

        const le = this._littleEndian;
        const v = new DataView(arrayBuffer, dataOffset, dataSize);

        let units = [],
            length = 0;

        let offset = 0;
        const lengthSize = this._naluLengthSize;
        const dts = this._timestampBase + tagTimestamp;
        let keyframe = (frameType === 1); // from FLV Frame Type constants

        while (offset < dataSize) {
            if (offset + 4 >= dataSize) {
                console.log(this.TAG, `Malformed Nalu near timestamp ${dts}, offset = ${offset}, dataSize = ${dataSize}`);
                break; // data not enough for next Nalu
            }
            // Nalu with length-header (AVC1)
            let naluSize = v.getUint32(offset, !le); // Big-Endian read
            if (lengthSize === 3) {
                naluSize >>>= 8;
            }
            if (naluSize > dataSize - lengthSize) {
                console.log(this.TAG, `Malformed Nalus near timestamp ${dts}, NaluSize > DataSize!`);
                return;
            }

            const unitType = v.getUint8(offset + lengthSize) & 0x1F;

            if (unitType === 5) { // IDR
                keyframe = true;
            }

            const data = new Uint8Array(arrayBuffer, dataOffset + offset, lengthSize + naluSize);
            const unit = { type: unitType, data };
            units.push(unit);
            length += data.byteLength;

            offset += lengthSize + naluSize;
        }

        if (units.length) {
            const track = this._videoTrack;
            const avcSample = {
                units,
                length,
                isKeyframe: keyframe,
                dts,
                cts,
                pts: (dts + cts)
            };
            if (keyframe) {
                avcSample.fileposition = tagPosition;
            }
            track.samples.push(avcSample);
            track.length += length;
        }
    }
    _parseAudioData(arrayBuffer, dataOffset, dataSize, tagTimestamp) {
        if (tagTimestamp == this._timestampBase && this._timestampBase != 0) {
            console.log(tagTimestamp, this._timestampBase, '夭寿啦这个视频不是从0开始');
            // timestampBase(0);
        }

        if (dataSize <= 1) {
            console.log(this.TAG, 'Flv: Invalid audio packet, missing SoundData payload!');
            return;
        }

        let meta = this._audioMetadata;
        const track = this._audioTrack;

        if (!meta || !meta.codec) {
            // initial metadata
            meta = this._audioMetadata = {};
            meta.type = 'audio';
            meta.id = track.id;
            meta.timescale = this._timescale;
            meta.duration = this._duration;

            const le = this._littleEndian;
            const v = new DataView(arrayBuffer, dataOffset, dataSize);

            const soundSpec = v.getUint8(0);

            const soundFormat = soundSpec >>> 4;
            if (soundFormat !== 10) { // AAC
                // TODO: support MP3 audio codec
                this._onError(DemuxErrors.CODEC_UNSUPPORTED, 'Flv: Unsupported audio codec idx: ' + soundFormat);
                return;
            }

            let soundRate = 0;
            const soundRateIndex = (soundSpec & 12) >>> 2;

            const soundRateTable = [5500, 11025, 22050, 44100, 48000];

            if (soundRateIndex < soundRateTable.length) {
                soundRate = soundRateTable[soundRateIndex];
            } else {
                this._onError(DemuxErrors.FORMAT_ERROR, 'Flv: Invalid audio sample rate idx: ' + soundRateIndex);
                return;
            }

            const soundSize = (soundSpec & 2) >>> 1; // unused
            const soundType = (soundSpec & 1);

            meta.audioSampleRate = soundRate;
            meta.channelCount = (soundType === 0 ? 1 : 2);
            meta.refSampleDuration = Math.floor(1024 / meta.audioSampleRate * meta.timescale);
            meta.codec = 'mp4a.40.5';
        }

        const aacData = this._parseAACAudioData(arrayBuffer, dataOffset + 1, dataSize - 1);
        if (aacData == undefined) {
            return;
        }

        if (aacData.packetType === 0) { // AAC sequence header (AudioSpecificConfig)
            if (meta.config) {
                console.log(this.TAG, 'Found another AudioSpecificConfig!');
            }
            const misc = aacData.data;
            meta.audioSampleRate = misc.samplingRate;
            meta.channelCount = misc.channelCount;
            meta.codec = misc.codec;
            meta.config = misc.config;
            // The decode result of an aac sample is 1024 PCM samples
            meta.refSampleDuration = Math.floor(1024 / meta.audioSampleRate * meta.timescale);
            console.log(this.TAG, 'Parsed AudioSpecificConfig');

            if (this._isInitialMetadataDispatched()) {
                // Non-initial metadata, force dispatch (or flush) parsed frames to remuxer
                if (this._dispatch && (this._audioTrack.length || this._videoTrack.length)) {
                    this._onDataAvailable(this._audioTrack, this._videoTrack);
                }
            } else {
                this._audioInitialMetadataDispatched = true;
            }
            // then notify new metadata
            this._dispatch = false;
            this._onTrackMetadata('audio', meta);

            const mi = this._mediaInfo;
            mi.audioCodec = 'mp4a.40.' + misc.originalAudioObjectType;
            mi.audioSampleRate = meta.audioSampleRate;
            mi.audioChannelCount = meta.channelCount;
            if (mi.hasVideo) {
                if (mi.videoCodec != null) {
                    mi.mimeType = 'video/x-flv; codecs="' + mi.videoCodec + ',' + mi.audioCodec + '"';
                }
            } else {
                mi.mimeType = 'video/x-flv; codecs="' + mi.audioCodec + '"';
            }
            if (mi.isComplete()) {
                this._onMediaInfo(mi);
            }
            return;
        } else if (aacData.packetType === 1) { // AAC raw frame data
            const dts = this._timestampBase + tagTimestamp;
            const aacSample = { unit: aacData.data, dts, pts: dts };
            track.samples.push(aacSample);
            track.length += aacData.data.length;
        } else {
            console.log(this.TAG, `Flv: Unsupported AAC data type ${aacData.packetType}`);
        }
    }

    _parseAACAudioData(arrayBuffer, dataOffset, dataSize) {
        if (dataSize <= 1) {
            console.log(this.TAG, 'Flv: Invalid AAC packet, missing AACPacketType or/and Data!');
            return;
        }

        const result = {};
        const array = new Uint8Array(arrayBuffer, dataOffset, dataSize);

        result.packetType = array[0];

        if (array[0] === 0) {
            result.data = this._parseAACAudioSpecificConfig(arrayBuffer, dataOffset + 1, dataSize - 1);
        } else {
            result.data = array.subarray(1);
        }

        return result;
    }

    _parseAACAudioSpecificConfig(arrayBuffer, dataOffset, dataSize) {
        const array = new Uint8Array(arrayBuffer, dataOffset, dataSize);
        let config = null;

        const mpegSamplingRates = [
            96000, 88200, 64000, 48000, 44100, 32000,
            24000, 22050, 16000, 12000, 11025, 8000, 7350
        ];

        /* Audio Object Type:
           0: Null
           1: AAC Main
           2: AAC LC
           3: AAC SSR (Scalable Sample Rate)
           4: AAC LTP (Long Term Prediction)
           5: HE-AAC / SBR (Spectral Band Replication)
           6: AAC Scalable
        */

        let audioObjectType = 0;
        let originalAudioObjectType = 0;
        let audioExtensionObjectType = null;
        let samplingIndex = 0;
        let extensionSamplingIndex = null;
        // debugger;
        // 5 bits
        audioObjectType = originalAudioObjectType = array[0] >>> 3;
        // 4 bits
        samplingIndex = ((array[0] & 0x07) << 1) | (array[1] >>> 7);
        if (samplingIndex < 0 || samplingIndex >= mpegSamplingRates.length) {
            this._onError(DemuxErrors.FORMAT_ERROR, 'Flv: AAC invalid sampling frequency index!');
            return;
        }

        const samplingFrequence = mpegSamplingRates[samplingIndex];

        // 4 bits
        const channelConfig = (array[1] & 0x78) >>> 3;
        if (channelConfig < 0 || channelConfig >= 8) {
            this._onError(DemuxErrors.FORMAT_ERROR, 'Flv: AAC invalid channel configuration');
            return;
        }

        if (audioObjectType === 5) { // HE-AAC?
            // 4 bits
            extensionSamplingIndex = ((array[1] & 0x07) << 1) | (array[2] >>> 7);
            // 5 bits
            audioExtensionObjectType = (array[2] & 0x7C) >>> 2;
        }

        // workarounds for various browsers
        const userAgent = self.navigator.userAgent.toLowerCase();

        if (userAgent.indexOf('firefox') !== -1) {
            // firefox: use SBR (HE-AAC) if freq less than 24kHz
            if (samplingIndex >= 6) {
                audioObjectType = 5;
                config = new Array(4);
                extensionSamplingIndex = samplingIndex - 3;
            } else { // use LC-AAC
                audioObjectType = 2;
                config = new Array(2);
                extensionSamplingIndex = samplingIndex;
            }
        } else if (userAgent.indexOf('android') !== -1) {
            // android: always use LC-AAC
            audioObjectType = 2;
            config = new Array(2);
            extensionSamplingIndex = samplingIndex;
        } else {
            // for other browsers, e.g. chrome...
            // Always use HE-AAC to make it easier to switch aac codec profile
            audioObjectType = 5;
            extensionSamplingIndex = samplingIndex;
            config = new Array(4);

            if (samplingIndex >= 6) {
                extensionSamplingIndex = samplingIndex - 3;
            } else if (channelConfig === 1) { // Mono channel
                audioObjectType = 2;
                config = new Array(2);
                extensionSamplingIndex = samplingIndex;
            }
        }

        config[0] = audioObjectType << 3;
        config[0] |= (samplingIndex & 0x0F) >>> 1;
        config[1] = (samplingIndex & 0x0F) << 7;
        config[1] |= (channelConfig & 0x0F) << 3;
        if (audioObjectType === 5) {
            config[1] |= ((extensionSamplingIndex & 0x0F) >>> 1);
            config[2] = (extensionSamplingIndex & 0x01) << 7;
            // extended audio object type: force to 2 (LC-AAC)
            config[2] |= (2 << 2);
            config[3] = 0;
        }

        return {
            config,
            samplingRate: samplingFrequence,
            channelCount: channelConfig,
            codec: 'mp4a.40.' + audioObjectType,
            originalAudioObjectType
        };
    }
    _isInitialMetadataDispatched() {
        if (this._hasAudio && this._hasVideo) { // both audio & video
            return this._audioInitialMetadataDispatched && this._videoInitialMetadataDispatched;
        }
        if (this._hasAudio && !this._hasVideo) { // audio only
            return this._audioInitialMetadataDispatched;
        }
        if (!this._hasAudio && this._hasVideo) { // video only
            return this._videoInitialMetadataDispatched;
        }
    }
}
var tagdemux = new tagDemux();

/* eslint-disable */
class FlvParse {
    constructor() {
        this.tempUint8 = new Uint8Array();
        this.arrTag = [];
        this.index = 0;
        this.tempArr = [];
        this.stop = false;
        this.offset = 0;
        this.frist = true;
        this._hasAudio = false;
        this._hasVideo = false;
    }

    /**
     * 接受 外部的flv二进制数据
     */
    setFlv(uint8) {
        this.stop = false;
        this.arrTag = [];
        this.index = 0;
        this.tempUint8 = uint8;
        if (this.tempUint8.length > 13 && this.tempUint8[0] == 70 && this.tempUint8[1] == 76 && this.tempUint8[2] == 86) {
            this.probe(this.tempUint8.buffer);
            this.read(9); // 略掉9个字节的flv header tag
            this.read(4); // 略掉第一个4字节的 tag size
            this.parse();
            this.frist = false;
            return this.offset;
        } else if (!this.frist) {
            return this.parse();
        } else {
            return this.offset;
        }
    }
    probe(buffer) {
        const data = new Uint8Array(buffer);
        const mismatch = { match: false };

        if (data[0] !== 0x46 || data[1] !== 0x4C || data[2] !== 0x56 || data[3] !== 0x01) {
            return mismatch;
        }

        const hasAudio = ((data[4] & 4) >>> 2) !== 0;
        const hasVideo = (data[4] & 1) !== 0;

        if (!hasAudio && !hasVideo) {
            return mismatch;
        }
        this._hasAudio = tagdemux._hasAudio = hasAudio;
        this._hasVideo = tagdemux._hasVideo = hasVideo;
        return {
            match: true,
            hasAudioTrack: hasAudio,
            hasVideoTrack: hasVideo
        };
    }

    /**
     * 开始解析
     */
    parse() {

        while (this.index < this.tempUint8.length && !this.stop) {
            this.offset = this.index;

            const t = new FlvTag();
            if (this.tempUint8.length - this.index >= 11) {
                t.tagType = (this.read(1)[0]); // 取出tag类型
                t.dataSize = this.read(3); // 取出包体大小
                t.Timestamp = this.read(4); // 取出解码时间
                t.StreamID = this.read(3); // 取出stream id
            } else {
                this.stop = true;
                continue;
            }
            if (t.tagType == 18 || t.tagType == 8 || t.tagType == 9) {
                
            } else {
                throw new Error('wrong tagType' + t.tagType);
            }
            if (this.tempUint8.length - this.index >= (this.getBodySum(t.dataSize) + 4)) {
                t.body = this.read(this.getBodySum(t.dataSize)); // 取出body
                if (t.tagType == 9 && this._hasVideo) {
                    this.arrTag.push(t);
                }
                if (t.tagType == 8 && this._hasAudio) {
                    this.arrTag.push(t);
                }
                if (t.tagType == 18 ) {
                    if(this.arrTag.length==0)
                    this.arrTag.push(t);
                    else{
                        // console.log('这是截获的自定义数据',t);
                    }
                }
                t.size=this.read(4);
            } else {
                this.stop = true;
                continue;
            }
            this.offset = this.index;
        }

        return this.offset;
    }
    read(length) {
        // let u8a = new Uint8Array(length);
        // u8a.set(this.tempUint8.subarray(this.index, this.index + length), 0);
        const u8a = this.tempUint8.slice(this.index, this.index + length);
        this.index += length;
        return u8a;
    }

    /**
     * 计算tag包体大小
     */
    getBodySum(arr) {
        let _str = '';
        _str += (arr[0].toString(16).length == 1 ? '0' + arr[0].toString(16) : arr[0].toString(16));
        _str += (arr[1].toString(16).length == 1 ? '0' + arr[1].toString(16) : arr[1].toString(16));
        _str += (arr[2].toString(16).length == 1 ? '0' + arr[2].toString(16) : arr[2].toString(16));
        return parseInt(_str, 16);
    }
}
var flvparse = new FlvParse();

/**
 * 代码借鉴了flv.js
 * 增加了自己的注释和写法
 */
/* eslint-disable */
class MP4 {

    static init() {
        MP4.types = {
            avc1: [],
            avcC: [],
            btrt: [],
            dinf: [],
            dref: [],
            esds: [],
            ftyp: [],
            hdlr: [],
            mdat: [],
            mdhd: [],
            mdia: [],
            mfhd: [],
            minf: [],
            moof: [],
            moov: [],
            mp4a: [],
            mvex: [],
            mvhd: [],
            sdtp: [],
            stbl: [],
            stco: [],
            stsc: [],
            stsd: [],
            stsz: [],
            stts: [],
            tfdt: [],
            tfhd: [],
            traf: [],
            trak: [],
            trun: [],
            trex: [],
            tkhd: [],
            vmhd: [],
            smhd: []
        };

        for (const name in MP4.types) {
            if (MP4.types.hasOwnProperty(name)) {
                MP4.types[name] = [
                    name.charCodeAt(0),
                    name.charCodeAt(1),
                    name.charCodeAt(2),
                    name.charCodeAt(3)
                ];
            }
        }

        const constants = MP4.constants = {};

        constants.FTYP = new Uint8Array([
            0x69, 0x73, 0x6F, 0x6D, // major_brand: isom		isom	MP4  Base Media v1 [IS0 14496-12:2003]	ISO	YES	video/mp4
            0x0, 0x0, 0x0, 0x1, // minor_version: 0x01
            0x69, 0x73, 0x6F, 0x6D, // isom
            0x61, 0x76, 0x63, 0x31 // avc1
        ]);

        constants.STSD_PREFIX = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags  version字段后会有一个entry count字段
            0x00, 0x00, 0x00, 0x01 // entry_count	根据entry的个数，每个entry会有type信息，如“vide”、“sund”等，根据type不同sample description会提供不同的信息，例如对于video track，会有“VisualSampleEntry”类型信息，对于audio track会有“AudioSampleEntry”类型信息。
        ]);

        constants.STTS = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00 // entry_count     0个索引
        ]);

        constants.STSC = constants.STCO = constants.STTS;

        constants.STSZ = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // sample_size
            0x00, 0x00, 0x00, 0x00 // sample_count
        ]);

        constants.HDLR_VIDEO = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x76, 0x69, 0x64, 0x65, // handler_type: 'vide' 在media box中，该值为4个字符		“vide”— video track
            0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // 保留位
            0x56, 0x69, 0x64, 0x65,
            0x6F, 0x48, 0x61, 0x6E,
            0x64, 0x6C, 0x65, 0x72, 0x00 // name: VideoHandler 长度不定		track type name，以‘\0’结尾的字符串
        ]);

        constants.HDLR_AUDIO = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x73, 0x6F, 0x75, 0x6E, // handler_type: 'soun'在media box中，该值为4个字符		“soun”— audio track
            0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // 保留位
            0x53, 0x6F, 0x75, 0x6E,
            0x64, 0x48, 0x61, 0x6E,
            0x64, 0x6C, 0x65, 0x72, 0x00 // name: SoundHandler 长度不定		track type name，以‘\0’结尾的字符串
        ]);

        constants.DREF = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x01, // entry_count 1个url
            // url	box开始
            0x00, 0x00, 0x00, 0x0C, // entry_size
            0x75, 0x72, 0x6C, 0x20, // type 'url '
            0x00, 0x00, 0x00, 0x01 // version(0) + flags 当“url”或“urn”的box flag为1时，字符串均为空。
        ]);

        // Sound media header
        constants.SMHD = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags	box版本，0或1，一般为0。
            0x00, 0x00, 0x00, 0x00 // balance(2) + reserved(2) 立体声平衡，[8.8] 格式值，一般为0，-1.0表示全部左声道，1.0表示全部右声道+2位保留位
        ]);

        // video media header
        constants.VMHD = new Uint8Array([
            0x00, 0x00, 0x00, 0x01, // version(0) + flags
            0x00, 0x00, // graphicsmode: 2 bytes 视频合成模式，为0时拷贝原始图像，否则与opcolor进行合成   //理论上是4位啊  暂时保留
            0x00, 0x00, 0x00, 0x00, // opcolor: 3 * 2 bytes ｛red，green，blue｝
            0x00, 0x00
        ]);
    }

    /**
     * 封装box
     */
    static box(type) {
        let size = 8;
        let result = null;
        const datas = Array.prototype.slice.call(arguments, 1);
        const arrayCount = datas.length;

        for (let i = 0; i < arrayCount; i++) {
            size += datas[i].byteLength;
        }
        // box头部大小
        result = new Uint8Array(size);
        result[0] = (size >>> 24) & 0xFF; // size
        result[1] = (size >>> 16) & 0xFF;
        result[2] = (size >>> 8) & 0xFF;
        result[3] = (size) & 0xFF;
        // 写入box的type
        result.set(type, 4); // type

        let offset = 8;
        for (let i = 0; i < arrayCount; i++) { // data body
            result.set(datas[i], offset);
            offset += datas[i].byteLength;
        }

        return result;
    }

    // 创建ftyp&moov
    static generateInitSegment(meta) {
        if (meta.constructor != Array) {
            meta = [meta];
        }
        const ftyp = MP4.box(MP4.types.ftyp, MP4.constants.FTYP);
        const moov = MP4.moov(meta);

        const result = new Uint8Array(ftyp.byteLength + moov.byteLength);
        result.set(ftyp, 0);
        result.set(moov, ftyp.byteLength);
        return result;
    }

    // Movie metadata box
    static moov(meta) {
        const mvhd = MP4.mvhd(meta[0].timescale, meta[0].duration); // /moov里面的第一个box
        const vtrak = MP4.trak(meta[0]);
        let atrak;
        if (meta.length > 1) {
            atrak = MP4.trak(meta[1]);
        }

        const mvex = MP4.mvex(meta);
        if (meta.length > 1) { return MP4.box(MP4.types.moov, mvhd, vtrak, atrak, mvex); } else { return MP4.box(MP4.types.moov, mvhd, vtrak, mvex); }
    }

    // Movie header box
    static mvhd(timescale, duration) {
        return MP4.box(MP4.types.mvhd, new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags     1位的box版本+3位flags   box版本，0或1，一般为0。（以下字节数均按version=0）
            0x00, 0x00, 0x00, 0x00, // creation_time    创建时间  （相对于UTC时间1904-01-01零点的秒数）
            0x00, 0x00, 0x00, 0x00, // modification_time   修改时间
            (timescale >>> 24) & 0xFF, // timescale: 4 bytes		文件媒体在1秒时间内的刻度值，可以理解为1秒长度
            (timescale >>> 16) & 0xFF,
            (timescale >>> 8) & 0xFF,
            (timescale) & 0xFF,
            (duration >>> 24) & 0xFF, // duration: 4 bytes	该track的时间长度，用duration和time scale值可以计算track时长，比如audio track的time scale = 8000, duration = 560128，时长为70.016，video track的time scale = 600, duration = 42000，时长为70
            (duration >>> 16) & 0xFF,
            (duration >>> 8) & 0xFF,
            (duration) & 0xFF,
            0x00, 0x01, 0x00, 0x00, // Preferred rate: 1.0   推荐播放速率，高16位和低16位分别为小数点整数部分和小数部分，即[16.16] 格式，该值为1.0（0x00010000）表示正常前向播放
            0x01, 0x00, 0x00, 0x00, // PreferredVolume(1.0, 2bytes) + reserved(2bytes)	与rate类似，[8.8] 格式，1.0（0x0100）表示最大音量
            0x00, 0x00, 0x00, 0x00, // reserved: 4 + 4 bytes	保留位
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00, // ----begin composition matrix----
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // 视频变换矩阵   线性代数
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x40, 0x00, 0x00, 0x00, // ----end composition matrix----
            0x00, 0x00, 0x00, 0x00, // ----begin pre_defined 6 * 4 bytes----
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // pre-defined 保留位
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // ----end pre_defined 6 * 4 bytes----
            0xFF, 0xFF, 0xFF, 0xFF // next_track_ID 下一个track使用的id号
        ]));
    }

    // Track box
    static trak(meta) {
        return MP4.box(MP4.types.trak, MP4.tkhd(meta), MP4.mdia(meta));
    }

    // Track header box
    static tkhd(meta) {
        let trackId = meta.id,
            duration = meta.duration;
        let width = meta.presentWidth,
            height = meta.presentHeight;

        return MP4.box(MP4.types.tkhd, new Uint8Array([
            0x00, 0x00, 0x00, 0x07, // version(0) + flags 1位版本 box版本，0或1，一般为0。（以下字节数均按version=0）按位或操作结果值，预定义如下：
            // 0x000001 track_enabled，否则该track不被播放；
            // 0x000002 track_in_movie，表示该track在播放中被引用；
            // 0x000004 track_in_preview，表示该track在预览时被引用。
            // 一般该值为7，1+2+4 如果一个媒体所有track均未设置track_in_movie和track_in_preview，将被理解为所有track均设置了这两项；对于hint track，该值为0
            // hint track  这个特殊的track并不包含媒体数据，而是包含了一些将其他数据track打包成流媒体的指示信息。
            0x00, 0x00, 0x00, 0x00, // creation_time	创建时间（相对于UTC时间1904-01-01零点的秒数）
            0x00, 0x00, 0x00, 0x00, // modification_time	修改时间
            (trackId >>> 24) & 0xFF, // track_ID: 4 bytes	id号，不能重复且不能为0
            (trackId >>> 16) & 0xFF,
            (trackId >>> 8) & 0xFF,
            (trackId) & 0xFF,
            0x00, 0x00, 0x00, 0x00, // reserved: 4 bytes    保留位
            (duration >>> 24) & 0xFF, // duration: 4 bytes  	track的时间长度
            (duration >>> 16) & 0xFF,
            (duration >>> 8) & 0xFF,
            (duration) & 0xFF,
            0x00, 0x00, 0x00, 0x00, // reserved: 2 * 4 bytes    保留位
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // layer(2bytes) + alternate_group(2bytes)  视频层，默认为0，值小的在上层.track分组信息，默认为0表示该track未与其他track有群组关系
            0x00, 0x00, 0x00, 0x00, // volume(2bytes) + reserved(2bytes)    [8.8] 格式，如果为音频track，1.0（0x0100）表示最大音量；否则为0   +保留位
            0x00, 0x01, 0x00, 0x00, // ----begin composition matrix----
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00, // 视频变换矩阵
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x40, 0x00, 0x00, 0x00, // ----end composition matrix----
            (width >>> 8) & 0xFF, // //宽度
            (width) & 0xFF,
            0x00, 0x00,
            (height >>> 8) & 0xFF, // 高度
            (height) & 0xFF,
            0x00, 0x00
        ]));
    }

    /**
     * “mdia”也是个container box，其子box的结构和种类还是比较复杂的。先来看一个“mdia”的实例结构树图。
     * 总体来说，“mdia”定义了track媒体类型以及sample数据，描述sample信息。一般“mdia”包含一个“mdhd”，
     * 一个“hdlr”和一个“minf”，其中“mdhd”为media header box，“hdlr”为handler reference box，
     * “minf”为media information box。
     *
     * mdia
     * 		mdhd
     * 		hdlr
     * 		minf
     * 			smhd
     * 			dinf
     * 				dref
     * 					url
     * 			stbl
     * 				stsd
     * 					mp4a
     * 						esds
     * 				stts
     * 				stsc
     * 				stsz
     * 				stco
     */
    static mdia(meta) {
        return MP4.box(MP4.types.mdia, MP4.mdhd(meta), MP4.hdlr(meta), MP4.minf(meta));
    }

    // Media header box
    static mdhd(meta) {
        const timescale = meta.timescale;
        const duration = meta.duration;
        return MP4.box(MP4.types.mdhd, new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags // version(0) + flags		box版本，0或1，一般为0。
            0x00, 0x00, 0x00, 0x00, // creation_time    创建时间
            0x00, 0x00, 0x00, 0x00, // modification_time修改时间
            (timescale >>> 24) & 0xFF, // timescale: 4 bytes    文件媒体在1秒时间内的刻度值，可以理解为1秒长度
            (timescale >>> 16) & 0xFF,
            (timescale >>> 8) & 0xFF,
            (timescale) & 0xFF,
            (duration >>> 24) & 0xFF, // duration: 4 bytes  track的时间长度
            (duration >>> 16) & 0xFF,
            (duration >>> 8) & 0xFF,
            (duration) & 0xFF,
            0x55, 0xC4, // language: und (undetermined) 媒体语言码。最高位为0，后面15位为3个字符（见ISO 639-2/T标准中定义）
            0x00, 0x00 // pre_defined = 0
        ]));
    }

    // Media handler reference box
    static hdlr(meta) {
        let data = null;
        if (meta.type === 'audio') {
            data = MP4.constants.HDLR_AUDIO;
        } else {
            data = MP4.constants.HDLR_VIDEO;
        }
        return MP4.box(MP4.types.hdlr, data);
    }

    /**
		 * “minf”存储了解释track媒体数据的handler-specific信息，media handler用这些信息将媒体时间映射到媒体数据并进行处理。“minf”中的信息格式和内容与媒体类型以及解释媒体数据的media handler密切相关，其他media handler不知道如何解释这些信息。“minf”是一个container box，其实际内容由子box说明。
    一般情况下，“minf”包含一个header box，一个“dinf”和一个“stbl”，其中，header box根据track type（即media handler type）分为“vmhd”、“smhd”、“hmhd”和“nmhd”，“dinf”为data information box，“stbl”为sample table box。下面分别介绍。

		 *
		 */
    // Media infomation box
    static minf(meta) {
        // header box根据track type（即media handler type）分为“vmhd”、“smhd”、“hmhd”和“nmhd”
        let xmhd = null;
        if (meta.type === 'audio') {
            xmhd = MP4.box(MP4.types.smhd, MP4.constants.SMHD);
        } else {
            xmhd = MP4.box(MP4.types.vmhd, MP4.constants.VMHD);
        }
        return MP4.box(MP4.types.minf, xmhd, MP4.dinf(), MP4.stbl(meta));
    }

    /**
     * Data Information Box
     * “dinf”解释如何定位媒体信息，是一个container box。“dinf”一般包含一个“dref”，即data reference box；
     * “dref”下会包含若干个“url”或“urn”，这些box组成一个表，用来定位track数据。
     * 简单的说，track可以被分成若干段，每一段都可以根据“url”或“urn”指向的地址来获取数据，
     * sample描述中会用这些片段的序号将这些片段组成一个完整的track。
     * 一般情况下，当数据被完全包含在文件中时，“url”或“urn”中的定位字符串是空的。
     */
    static dinf() {
        const result = MP4.box(MP4.types.dinf,
            MP4.box(MP4.types.dref, MP4.constants.DREF)
        );
        return result;
    }

    /**
		 * Sample Table Box（stbl）
    	*	“stbl”几乎是普通的MP4文件中最复杂的一个box了，首先需要回忆一下sample的概念。
 		* 	sample是媒体数据存储的单位，存储在media的chunk中，chunk和sample的长度均可互不相同，如下图所示。
			“stbl”是一个container box，其子box包括：sample description box（stsd）、
			 * time to sample box（stts）、sample size box（stsz或stz2）、
			 * sample to chunk box（stsc）、chunk offset box（stco或co64）、
			 * composition time to sample box（ctts）、sync sample box（stss）
			 * stsd”必不可少，且至少包含一个条目，该box包含了data reference box进行sample数据检索的信息。
			 * 没有“stsd”就无法计算media sample的存储位置。“stsd”包含了编码的信息，其存储的信息随媒体类型不同而不同。
			 * 			stbl
			 * 				stsd
			 * 					avc1
			 * 						avcC
			 * 				stts
			 * 				stsc
			 * 				stsz
			 * 				stco
		 */
    static stbl(meta) {
        const result = MP4.box(MP4.types.stbl, // type: stbl
            MP4.stsd(meta), // Sample Description Table
            MP4.box(MP4.types.stts, MP4.constants.STTS), // Time-To-Sample    因为stts的entry count 为0
            // 所以没有关键帧index 的stss
            // 也没有CTTS box CTTS是记录偏移量
            MP4.box(MP4.types.stsc, MP4.constants.STSC), // Sample-To-Chunk
            MP4.box(MP4.types.stsz, MP4.constants.STSZ), // Sample size
            MP4.box(MP4.types.stco, MP4.constants.STCO) // Chunk offset
        );
        return result;
    }

    /**
		 * Sample Description Box（stsd）
    		box header和version字段后会有一个entry count字段，
 * 			根据entry的个数，每个entry会有type信息，如“vide”、“sund”等，
 * 		根据type不同sample description会提供不同的信息，例如对于video track，
 * 会有“VisualSampleEntry”类型信息，对于audio track会有“AudioSampleEntry”类型信息。

		 * * 				stsd
			* 					mp4a
			* 						esds
			 *
			 *
			 *
			 *
			 * 		 4 bytes - length in total
					 4 bytes - 4 char code of sample description table (stsd)
					 4 bytes - version & flags
					 4 bytes - number of sample entries (num_sample_entries)
						 [
						    4 bytes - length of sample entry (len_sample_entry)
						    4 bytes - 4 char code of sample entry
						    ('len_sample_entry' - 8) bytes of data
						 ] (repeated 'num_sample_entries' times)
					(4 bytes - optional 0x00000000 as end of box marker )
		 */
    static stsd(meta) {
        if (meta.type === 'audio') {
            return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.mp4a(meta));
        } else {
            return MP4.box(MP4.types.stsd, MP4.constants.STSD_PREFIX, MP4.avc1(meta));
        }
    }

    static mp4a(meta) {
        const channelCount = meta.channelCount;
        const sampleRate = meta.audioSampleRate;

        const data = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // reserved(4) 6个字节，设置为0；
            0x00, 0x00, 0x00, 0x01, // reserved(2) + data_reference_index(2)
            0x00, 0x00, 0x00, 0x00, // reserved: 2 * 4 bytes 保留位
            0x00, 0x00, 0x00, 0x00,
            0x00, channelCount, // channelCount(2) 单声道还是双声道
            0x00, 0x10, // sampleSize(2)
            0x00, 0x00, 0x00, 0x00, // reserved(4) 4字节保留位
            (sampleRate >>> 8) & 0xFF, // Audio sample rate 显然要右移16位才有意义	template unsigned int(32) samplerate = {timescale of media}<<16;
            (sampleRate) & 0xFF,
            0x00, 0x00
        ]);

        return MP4.box(MP4.types.mp4a, data, MP4.esds(meta));
    }

    static esds(meta) {
        const config = meta.config;
        const configSize = config.length;
        const data = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version 0 + flags

            0x03, // descriptor_type    MP4ESDescrTag
            0x17 + configSize, // length3
            0x00, 0x01, // es_id
            0x00, // stream_priority

            0x04, // descriptor_type    MP4DecConfigDescrTag
            0x0F + configSize, // length
            0x40, // codec: mpeg4_audio
            /**
             *当objectTypeIndication为0x40时，为MPEG-4 Audio（MPEG-4 Audio generally is thought of as AAC
             * but there is a whole framework of audio codecs that can Go in MPEG-4 Audio including AAC, BSAC, ALS, CELP,
             * and something called MP3On4），如果想更细分format为aac还是mp3，
             * 可以读取MP4DecSpecificDescr层data[0]的前五位
             */
            0x15, // stream_type: Audio
            0x00, 0x00, 0x00, // buffer_size
            0x00, 0x00, 0x00, 0x00, // maxBitrate
            0x00, 0x00, 0x00, 0x00, // avgBitrate

            0x05 // descriptor_type MP4DecSpecificDescrTag
        ].concat([
            configSize
        ]).concat(
            config
        ).concat([
            0x06, 0x01, 0x02 // GASpecificConfig
        ]));
        return MP4.box(MP4.types.esds, data);
    }

    /**
     * 改版
     *stsd下的avc1视频解析
     */
    static avc1(meta) {
        const avcc = meta.avcc;
        let width = meta.codecWidth,
            height = meta.codecHeight;

        const data = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // // reserved(4)    6个 保留位	Reserved：6个字节，设置为0；
            0x00, 0x00, 0x00, 0x01, // reserved(2) + {{{{data_reference_index(2)  数据引用索引}}}}
            0x00, 0x00, 0x00, 0x00, // pre_defined(2) + reserved(2)
            0x00, 0x00, 0x00, 0x00, // pre_defined: 3 * 4 bytes  3*4个字节的保留位
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            (width >>> 8) & 0xFF, // width: 2 bytes
            (width) & 0xFF,
            (height >>> 8) & 0xFF, // height: 2 bytes
            (height) & 0xFF,
            0x00, 0x48, 0x00, 0x00, // horizresolution: 4 bytes 常数
            0x00, 0x48, 0x00, 0x00, // vertresolution: 4 bytes 常数
            0x00, 0x00, 0x00, 0x00, // reserved: 4 bytes 保留位
            0x00, 0x01, // frame_count
            // frame_count表明多少帧压缩视频存储在每个样本。默认是1,每样一帧;它可能超过1每个样本的多个帧数
            0x04, //	strlen compressorname: 32 bytes			String[32]
            // 32个8 bit    第一个8bit表示长度,剩下31个8bit表示内容
            0x67, 0x31, 0x31, 0x31, // compressorname: 32 bytes    翻译过来是g111
            0x00, 0x00, 0x00, 0x00, //
            0x00, 0x00, 0x00, 0x00, //
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00,
            0x00, 0x18, // depth 颜色深度
            0xFF, 0xFF // pre_defined = -1
        ]);
        return MP4.box(MP4.types.avc1, data, MP4.box(MP4.types.avcC, avcc));
    }

    // Movie Extends box
    static mvex(meta) {
        if (meta.length > 1) { return MP4.box(MP4.types.mvex, MP4.trex(meta[0]), MP4.trex(meta[1])); } else { return MP4.box(MP4.types.mvex, MP4.trex(meta[0])); }
    }

    // Track Extends box
    static trex(meta) {
        const trackId = meta.id;
        const data = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            (trackId >>> 24) & 0xFF, // track_ID
            (trackId >>> 16) & 0xFF,
            (trackId >>> 8) & 0xFF,
            (trackId) & 0xFF,
            0x00, 0x00, 0x00, 0x01, // default_sample_description_index
            0x00, 0x00, 0x00, 0x00, // default_sample_duration
            0x00, 0x00, 0x00, 0x00, // default_sample_size
            0x00, 0x01, 0x00, 0x01 // default_sample_flags
        ]);
        // if (meta.type !== 'video') {
        //     data[data.length - 1] = 0x00;
        // }
        return MP4.box(MP4.types.trex, data);
    }

    // Movie fragment box
    static moof(track, baseMediaDecodeTime) {
        return MP4.box(MP4.types.moof, MP4.mfhd(track.sequenceNumber), MP4.traf(track, baseMediaDecodeTime));
    }

    static mfhd(sequenceNumber) {
        const data = new Uint8Array([
            0x00, 0x00, 0x00, 0x00,
            (sequenceNumber >>> 24) & 0xFF, // sequence_number: int32
            (sequenceNumber >>> 16) & 0xFF,
            (sequenceNumber >>> 8) & 0xFF,
            (sequenceNumber) & 0xFF
        ]);
        return MP4.box(MP4.types.mfhd, data);
    }

    // Track fragment box
    static traf(track, baseMediaDecodeTime) {
        const trackId = track.id;

        // Track fragment header box
        const tfhd = MP4.box(MP4.types.tfhd, new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) & flags
            (trackId >>> 24) & 0xFF, // track_ID
            (trackId >>> 16) & 0xFF,
            (trackId >>> 8) & 0xFF,
            (trackId) & 0xFF
        ]));
        // Track Fragment Decode Time
        const tfdt = MP4.box(MP4.types.tfdt, new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) & flags
            (baseMediaDecodeTime >>> 24) & 0xFF, // baseMediaDecodeTime: int32
            (baseMediaDecodeTime >>> 16) & 0xFF,
            (baseMediaDecodeTime >>> 8) & 0xFF,
            (baseMediaDecodeTime) & 0xFF
        ]));
        const sdtp = MP4.sdtp(track);
        const trun = MP4.trun(track, sdtp.byteLength + 16 + 16 + 8 + 16 + 8 + 8);

        return MP4.box(MP4.types.traf, tfhd, tfdt, trun, sdtp);
    }

    // Sample Dependency Type box
    static sdtp(track) {
        const samples = track.samples || [];
        const sampleCount = samples.length;
        const data = new Uint8Array(4 + sampleCount);
        // 0~4 bytes: version(0) & flags
        for (let i = 0; i < sampleCount; i++) {
            const flags = samples[i].flags;
            data[i + 4] = (flags.isLeading << 6) // is_leading: 2 (bit)
                |
                (flags.dependsOn << 4) // sample_depends_on
                |
                (flags.isDependedOn << 2) // sample_is_depended_on
                |
                (flags.hasRedundancy); // sample_has_redundancy
        }
        return MP4.box(MP4.types.sdtp, data);
    }

    // Track fragment run box
    static trun(track, offset) {
        const samples = track.samples || [];
        const sampleCount = samples.length;
        const dataSize = 12 + 16 * sampleCount;
        const data = new Uint8Array(dataSize);
        offset += 8 + dataSize;

        data.set([
            0x00, 0x00, 0x0F, 0x01, // version(0) & flags
            (sampleCount >>> 24) & 0xFF, // sample_count
            (sampleCount >>> 16) & 0xFF,
            (sampleCount >>> 8) & 0xFF,
            (sampleCount) & 0xFF,
            (offset >>> 24) & 0xFF, // data_offset
            (offset >>> 16) & 0xFF,
            (offset >>> 8) & 0xFF,
            (offset) & 0xFF
        ], 0);

        for (let i = 0; i < sampleCount; i++) {

            const duration = samples[i].duration;

            const size = samples[i].size;
            const flags = samples[i].flags;
            const cts = samples[i].cts;
            data.set([
                (duration >>> 24) & 0xFF, // sample_duration
                (duration >>> 16) & 0xFF,
                (duration >>> 8) & 0xFF,
                (duration) & 0xFF,
                (size >>> 24) & 0xFF, // sample_size
                (size >>> 16) & 0xFF,
                (size >>> 8) & 0xFF,
                (size) & 0xFF,
                (flags.isLeading << 2) | flags.dependsOn, // sample_flags
                (flags.isDependedOn << 6) | (flags.hasRedundancy << 4) | flags.isNonSync,
                0x00, 0x00, // sample_degradation_priority
                (cts >>> 24) & 0xFF, // sample_composition_time_offset
                (cts >>> 16) & 0xFF,
                (cts >>> 8) & 0xFF,
                (cts) & 0xFF
            ], 12 + 16 * i);
        }
        return MP4.box(MP4.types.trun, data);
    }

    static mdat(data) {
        return MP4.box(MP4.types.mdat, data);
    }

}

MP4.init();

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * This file is modified from dailymotion's hls.js library (hls.js/src/helper/aac.js)
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable */
class AAC {

    static getSilentFrame(channelCount) {
        if (channelCount === 1) {
            return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x23, 0x80]);
        } else if (channelCount === 2) {
            return new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]);
        } else if (channelCount === 3) {
            return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x8e]);
        } else if (channelCount === 4) {
            return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x80, 0x2c, 0x80, 0x08, 0x02, 0x38]);
        } else if (channelCount === 5) {
            return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x38]);
        } else if (channelCount === 6) {
            return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x00, 0xb2, 0x00, 0x20, 0x08, 0xe0]);
        }
        return null;
    }

}

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable */
const Browser = {};

function detect() {
    // modified from jquery-browser-plugin

    const ua = self.navigator.userAgent.toLowerCase();

    const match = /(edge)\/([\w.]+)/.exec(ua) ||
        /(opr)[\/]([\w.]+)/.exec(ua) ||
        /(chrome)[ \/]([\w.]+)/.exec(ua) ||
        /(iemobile)[\/]([\w.]+)/.exec(ua) ||
        /(version)(applewebkit)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec(ua) ||
        /(webkit)[ \/]([\w.]+).*(version)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec(ua) ||
        /(webkit)[ \/]([\w.]+)/.exec(ua) ||
        /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
        /(msie) ([\w.]+)/.exec(ua) ||
        ua.indexOf('trident') >= 0 && /(rv)(?::| )([\w.]+)/.exec(ua) ||
        ua.indexOf('compatible') < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) || [];

    const platform_match = /(ipad)/.exec(ua) ||
        /(ipod)/.exec(ua) ||
        /(windows phone)/.exec(ua) ||
        /(iphone)/.exec(ua) ||
        /(kindle)/.exec(ua) ||
        /(android)/.exec(ua) ||
        /(windows)/.exec(ua) ||
        /(mac)/.exec(ua) ||
        /(linux)/.exec(ua) ||
        /(cros)/.exec(ua) || [];

    const matched = {
        browser: match[5] || match[3] || match[1] || '',
        version: match[2] || match[4] || '0',
        majorVersion: match[4] || match[2] || '0',
        platform: platform_match[0] || ''
    };

    const browser = {};
    if (matched.browser) {
        browser[matched.browser] = true;

        const versionArray = matched.majorVersion.split('.');
        browser.version = {
            major: parseInt(matched.majorVersion, 10),
            string: matched.version
        };
        if (versionArray.length > 1) {
            browser.version.minor = parseInt(versionArray[1], 10);
        }
        if (versionArray.length > 2) {
            browser.version.build = parseInt(versionArray[2], 10);
        }
    }

    if (matched.platform) {
        browser[matched.platform] = true;
    }

    if (browser.chrome || browser.opr || browser.safari) {
        browser.webkit = true;
    }

    // MSIE. IE11 has 'rv' identifer
    if (browser.rv || browser.iemobile) {
        if (browser.rv) {
            delete browser.rv;
        }
        const msie = 'msie';
        matched.browser = msie;
        browser[msie] = true;
    }

    // Microsoft Edge
    if (browser.edge) {
        delete browser.edge;
        const msedge = 'msedge';
        matched.browser = msedge;
        browser[msedge] = true;
    }

    // Opera 15+
    if (browser.opr) {
        const opera = 'opera';
        matched.browser = opera;
        browser[opera] = true;
    }

    // Stock android browsers are marked as Safari
    if (browser.safari && browser.android) {
        const android = 'android';
        matched.browser = android;
        browser[android] = true;
    }

    browser.name = matched.browser;
    browser.platform = matched.platform;

    for (const key in Browser) {
        if (Browser.hasOwnProperty(key)) {
            delete Browser[key];
        }
    }
    Object.assign(Browser, browser);
}

detect();

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable */
// Represents an media sample (audio / video)
class SampleInfo {

    constructor(dts, pts, duration, originalDts, isSync) {
        this.dts = dts;
        this.pts = pts;
        this.duration = duration;
        this.originalDts = originalDts;
        this.isSyncPoint = isSync;
        this.fileposition = null;
    }

}

// Media Segment concept is defined in Media Source Extensions spec.
// Particularly in ISO BMFF format, an Media Segment contains a moof box followed by a mdat box.
class MediaSegmentInfo {

    constructor() {
        this.beginDts = 0;
        this.endDts = 0;
        this.beginPts = 0;
        this.endPts = 0;
        this.originalBeginDts = 0;
        this.originalEndDts = 0;
        this.syncPoints = []; // SampleInfo[n], for video IDR frames only
        this.firstSample = null; // SampleInfo
        this.lastSample = null; // SampleInfo
    }

    appendSyncPoint(sampleInfo) { // also called Random Access Point
        sampleInfo.isSyncPoint = true;
        this.syncPoints.push(sampleInfo);
    }

}

// Ordered list for recording video IDR frames, sorted by originalDts


// Data structure for recording information of media segments in single track.
class MediaSegmentInfoList {

    constructor(type) {
        this._type = type;
        this._list = [];
        this._lastAppendLocation = -1; // cached last insert location
    }

    get type() {
        return this._type;
    }

    get length() {
        return this._list.length;
    }

    isEmpty() {
        return this._list.length === 0;
    }

    clear() {
        this._list = [];
        this._lastAppendLocation = -1;
    }

    _searchNearestSegmentBefore(originalBeginDts) {
        const list = this._list;
        if (list.length === 0) {
            return -2;
        }
        const last = list.length - 1;
        let mid = 0;
        let lbound = 0;
        let ubound = last;

        let idx = 0;

        if (originalBeginDts < list[0].originalBeginDts) {
            idx = -1;
            return idx;
        }

        while (lbound <= ubound) {
            mid = lbound + Math.floor((ubound - lbound) / 2);
            if (mid === last || (originalBeginDts > list[mid].lastSample.originalDts &&
                    (originalBeginDts < list[mid + 1].originalBeginDts))) {
                idx = mid;
                break;
            } else if (list[mid].originalBeginDts < originalBeginDts) {
                lbound = mid + 1;
            } else {
                ubound = mid - 1;
            }
        }
        return idx;
    }

    _searchNearestSegmentAfter(originalBeginDts) {
        return this._searchNearestSegmentBefore(originalBeginDts) + 1;
    }

    append(mediaSegmentInfo) {
        const list = this._list;
        const msi = mediaSegmentInfo;
        const lastAppendIdx = this._lastAppendLocation;
        let insertIdx = 0;

        if (lastAppendIdx !== -1 && lastAppendIdx < list.length &&
            msi.originalBeginDts >= list[lastAppendIdx].lastSample.originalDts &&
            ((lastAppendIdx === list.length - 1) ||
                (lastAppendIdx < list.length - 1 &&
                    msi.originalBeginDts < list[lastAppendIdx + 1].originalBeginDts))) {
            insertIdx = lastAppendIdx + 1; // use cached location idx
        } else {
            if (list.length > 0) {
                insertIdx = this._searchNearestSegmentBefore(msi.originalBeginDts) + 1;
            }
        }

        this._lastAppendLocation = insertIdx;
        this._list.splice(insertIdx, 0, msi);
    }

    getLastSegmentBefore(originalBeginDts) {
        const idx = this._searchNearestSegmentBefore(originalBeginDts);
        if (idx >= 0) {
            return this._list[idx];
        } else { // -1
            return null;
        }
    }

    getLastSampleBefore(originalBeginDts) {
        const segment = this.getLastSegmentBefore(originalBeginDts);
        if (segment != null) {
            return segment.lastSample;
        } else {
            return null;
        }
    }

    getLastSyncPointBefore(originalBeginDts) {
        let segmentIdx = this._searchNearestSegmentBefore(originalBeginDts);
        let syncPoints = this._list[segmentIdx].syncPoints;
        while (syncPoints.length === 0 && segmentIdx > 0) {
            segmentIdx--;
            syncPoints = this._list[segmentIdx].syncPoints;
        }
        if (syncPoints.length > 0) {
            return syncPoints[syncPoints.length - 1];
        } else {
            return null;
        }
    }

}

/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// import Log from '../utils/logger.js';
// Fragmented mp4 remuxer
class MP4Remuxer {

    constructor(config) {
        this.TAG = 'MP4Remuxer';

        this._config = config;
        this._isLive = (config.isLive === true) ? true : false;

        this._dtsBase = -1;
        this._dtsBaseInited = false;
        this._audioDtsBase = Infinity;
        this._videoDtsBase = Infinity;
        this._audioNextDts = undefined;
        this._videoNextDts = undefined;

        this._audioMeta = null;
        this._videoMeta = null;

        this._audioSegmentInfoList = new MediaSegmentInfoList('audio');
        this._videoSegmentInfoList = new MediaSegmentInfoList('video');

        this._onInitSegment = null;
        this._onMediaSegment = null;

        // Workaround for chrome < 50: Always force first sample as a Random Access Point in media segment
        // see https://bugs.chromium.org/p/chromium/issues/detail?id=229412
        this._forceFirstIDR = (Browser.chrome &&
                              (Browser.version.major < 50 ||
                              (Browser.version.major === 50 && Browser.version.build < 2661))) ? true : false;

        // Workaround for IE11/Edge: Fill silent aac frame after keyframe-seeking
        // Make audio beginDts equals with video beginDts, in order to fix seek freeze
        this._fillSilentAfterSeek = (Browser.msedge || Browser.msie);

        // While only FireFox supports 'audio/mp4, codecs="mp3"', use 'audio/mpeg' for chrome, safari, ...
        this._mp3UseMpegAudio = !Browser.firefox;
    }

    destroy() {
        this._dtsBase = -1;
        this._dtsBaseInited = false;
        this._audioMeta = null;
        this._videoMeta = null;
        this._audioSegmentInfoList.clear();
        this._audioSegmentInfoList = null;
        this._videoSegmentInfoList.clear();
        this._videoSegmentInfoList = null;
        this._onInitSegment = null;
        this._onMediaSegment = null;
    }

    bindDataSource(producer) {
        producer.onDataAvailable = this.remux.bind(this);
        producer.onTrackMetadata = this._onTrackMetadataReceived.bind(this);
        return this;
    }

    /* prototype: function onInitSegment(type: string, initSegment: ArrayBuffer): void
       InitSegment: {
           type: string,
           data: ArrayBuffer,
           codec: string,
           container: string
       }
    */
    get onInitSegment() {
        return this._onInitSegment;
    }

    set onInitSegment(callback) {
        this._onInitSegment = callback;
    }

    /* prototype: function onMediaSegment(type: string, mediaSegment: MediaSegment): void
       MediaSegment: {
           type: string,
           data: ArrayBuffer,
           sampleCount: int32
           info: MediaSegmentInfo
       }
    */
    get onMediaSegment() {
        return this._onMediaSegment;
    }

    set onMediaSegment(callback) {
        this._onMediaSegment = callback;
    }

    insertDiscontinuity() {
        this._audioNextDts = this._videoNextDts = undefined;
    }

    seek(originalDts) {
        this._videoSegmentInfoList.clear();
        this._audioSegmentInfoList.clear();
    }

    remux(audioTrack, videoTrack) {
        if (!this._onMediaSegment) {
            throw new IllegalStateException('MP4Remuxer: onMediaSegment callback must be specificed!');
        }
        if (!this._dtsBaseInited) {
            this._calculateDtsBase(audioTrack, videoTrack);
        }
        this._remuxVideo(videoTrack);
        this._remuxAudio(audioTrack);
    }

    _onTrackMetadataReceived(type, metadata) {
        let metabox = null;

        let container = 'mp4';
        let codec = metadata.codec;

        if (type === 'audio') {
            this._audioMeta = metadata;
            if (metadata.codec === 'mp3' && this._mp3UseMpegAudio) {
                // 'audio/mpeg' for MP3 audio track
                container = 'mpeg';
                codec = '';
                metabox = new Uint8Array();
            } else {
                // 'audio/mp4, codecs="codec"'
                metabox = MP4.generateInitSegment(metadata);
            }
        } else if (type === 'video') {
            this._videoMeta = metadata;
            metabox = MP4.generateInitSegment(metadata);
        } else {
            return;
        }

        // dispatch metabox (Initialization Segment)
        if (!this._onInitSegment) {
            throw new IllegalStateException('MP4Remuxer: onInitSegment callback must be specified!');
        }
        this._onInitSegment(type, {
            type: type,
            data: metabox.buffer,
            codec: codec,
            container: `${type}/${container}`,
            mediaDuration: metadata.duration  // in timescale 1000 (milliseconds)
        });
    }

    _calculateDtsBase(audioTrack, videoTrack) {
        if (this._dtsBaseInited) {
            return;
        }

        if (audioTrack.samples && audioTrack.samples.length) {
            this._audioDtsBase = audioTrack.samples[0].dts;
        }
        if (videoTrack.samples && videoTrack.samples.length) {
            this._videoDtsBase = videoTrack.samples[0].dts;
        }

        this._dtsBase = Math.min(this._audioDtsBase, this._videoDtsBase);
        this._dtsBaseInited = true;
    }

    _remuxAudio(audioTrack) {
        if (this._audioMeta == null) {
            return;
        }

        let track = audioTrack;
        let samples = track.samples;
        let dtsCorrection = undefined;
        let firstDts = -1, lastDts = -1, lastPts = -1;
        let refSampleDuration = this._audioMeta.refSampleDuration;

        let mpegRawTrack = this._audioMeta.codec === 'mp3' && this._mp3UseMpegAudio;
        let firstSegmentAfterSeek = this._dtsBaseInited && this._audioNextDts === undefined;

        let insertPrefixSilentFrame = false;

        if (!samples || samples.length === 0) {
            return;
        }

        let offset = 0;
        let mdatbox = null;
        let mdatBytes = 0;

        // calculate initial mdat size
        if (mpegRawTrack) {
            // for raw mpeg buffer
            offset = 0;
            mdatBytes = track.length;
        } else {
            // for fmp4 mdat box
            offset = 8;  // size + type
            mdatBytes = 8 + track.length;
        }

        let firstSampleOriginalDts = samples[0].dts - this._dtsBase;

        // calculate dtsCorrection
        if (this._audioNextDts) {
            dtsCorrection = firstSampleOriginalDts - this._audioNextDts;
        } else {  // this._audioNextDts == undefined
            if (this._audioSegmentInfoList.isEmpty()) {
                dtsCorrection = 0;
                if (this._fillSilentAfterSeek && !this._videoSegmentInfoList.isEmpty()) {
                    if (this._audioMeta.originalCodec !== 'mp3') {
                        insertPrefixSilentFrame = true;
                    }
                }
            } else {
                let lastSample = this._audioSegmentInfoList.getLastSampleBefore(firstSampleOriginalDts);
                if (lastSample != null) {
                    let distance = (firstSampleOriginalDts - (lastSample.originalDts + lastSample.duration));
                    if (distance <= 3) {
                        distance = 0;
                    }
                    let expectedDts = lastSample.dts + lastSample.duration + distance;
                    dtsCorrection = firstSampleOriginalDts - expectedDts;
                } else { // lastSample == null, cannot found
                    dtsCorrection = 0;
                }
            }
        }
        
        if (insertPrefixSilentFrame) {
            // align audio segment beginDts to match with current video segment's beginDts
            let firstSampleDts = firstSampleOriginalDts - dtsCorrection;
            let videoSegment = this._videoSegmentInfoList.getLastSegmentBefore(firstSampleOriginalDts);
            if (videoSegment != null && videoSegment.beginDts < firstSampleDts) {
                let silentUnit = AAC.getSilentFrame(this._audioMeta.originalCodec, this._audioMeta.channelCount);
                if (silentUnit) {
                    let dts = videoSegment.beginDts;
                    let silentFrameDuration = firstSampleDts - videoSegment.beginDts;
                    Log.v(this.TAG, `InsertPrefixSilentAudio: dts: ${dts}, duration: ${silentFrameDuration}`);
                    samples.unshift({unit: silentUnit, dts: dts, pts: dts});
                    mdatBytes += silentUnit.byteLength;
                }  // silentUnit == null: Cannot generate, skip
            } else {
                insertPrefixSilentFrame = false;
            }
        }

        let mp4Samples = [];

        // Correct dts for each sample, and calculate sample duration. Then output to mp4Samples
        for (let i = 0; i < samples.length; i++) {
            let sample = samples[i];
            let unit = sample.unit;
            let originalDts = sample.dts - this._dtsBase;
            let dts = originalDts - dtsCorrection;

            if (firstDts === -1) {
                firstDts = dts;
            }

            let sampleDuration = 0;

            if (i !== samples.length - 1) {
                let nextDts = samples[i + 1].dts - this._dtsBase - dtsCorrection;
                sampleDuration = nextDts - dts;
            } else {  // the last sample
                if (mp4Samples.length >= 1) {  // use second last sample duration
                    sampleDuration = mp4Samples[mp4Samples.length - 1].duration;
                } else {  // the only one sample, use reference sample duration
                    sampleDuration = Math.floor(refSampleDuration);
                }
            }

            let needFillSilentFrames = false;
            let silentFrames = null;

            // Silent frame generation, if large timestamp gap detected
            if (sampleDuration > refSampleDuration * 1.5 && this._audioMeta.codec !== 'mp3') {
                // We need to insert silent frames to fill timestamp gap
                needFillSilentFrames = true;
                let delta = Math.abs(sampleDuration - refSampleDuration);
                let frameCount = Math.ceil(delta / refSampleDuration);
                let currentDts = dts + refSampleDuration;  // Notice: in float

                // console.log(this.TAG, 'Large audio timestamp gap detected, may cause AV sync to drift. ' +
                //                 'Silent frames will be generated to avoid unsync.\n' +
                //                 `dts: ${dts + sampleDuration} ms, expected: ${dts + Math.round(refSampleDuration)} ms, ` +
                //                 `delta: ${Math.round(delta)} ms, generate: ${frameCount} frames`);

                let silentUnit = AAC.getSilentFrame(this._audioMeta.originalCodec, this._audioMeta.channelCount);
                if (silentUnit == null) {
                    // console.log(this.TAG, 'Unable to generate silent frame for ' +
                    //                 `${this._audioMeta.originalCodec} with ${this._audioMeta.channelCount} channels, repeat last frame`);
                    // Repeat last frame
                    silentUnit = unit;
                }
                silentFrames = [];

                for (let j = 0; j < frameCount; j++) {
                    let intDts = Math.round(currentDts);  // round to integer
                    if (silentFrames.length > 0) {
                        // Set previous frame sample duration
                        let previousFrame = silentFrames[silentFrames.length - 1];
                        previousFrame.duration = intDts - previousFrame.dts;
                    }
                    let frame = {
                        dts: intDts,
                        pts: intDts,
                        cts: 0,
                        unit: silentUnit,
                        size: silentUnit.byteLength,
                        duration: 0,  // wait for next sample
                        originalDts: originalDts,
                        flags: {
                            isLeading: 0,
                            dependsOn: 1,
                            isDependedOn: 0,
                            hasRedundancy: 0
                        }
                    };
                    silentFrames.push(frame);
                    mdatBytes += unit.byteLength;
                    currentDts += refSampleDuration;
                }

                // last frame: align end time to next frame dts
                let lastFrame = silentFrames[silentFrames.length - 1];
                lastFrame.duration = dts + sampleDuration - lastFrame.dts;

                // silentFrames.forEach((frame) => {
                //     Log.w(this.TAG, `SilentAudio: dts: ${frame.dts}, duration: ${frame.duration}`);
                // });

                // Set correct sample duration for current frame
                sampleDuration = Math.round(refSampleDuration);
            }

            mp4Samples.push({
                dts: dts,
                pts: dts,
                cts: 0,
                unit: sample.unit,
                size: sample.unit.byteLength,
                duration: sampleDuration,
                originalDts: originalDts,
                flags: {
                    isLeading: 0,
                    dependsOn: 1,
                    isDependedOn: 0,
                    hasRedundancy: 0
                }
            });

            if (needFillSilentFrames) {
                // Silent frames should be inserted after wrong-duration frame
                mp4Samples.push.apply(mp4Samples, silentFrames);
            }
        }

        // allocate mdatbox
        if (mpegRawTrack) {
            // allocate for raw mpeg buffer
            mdatbox = new Uint8Array(mdatBytes);
        } else {
            // allocate for fmp4 mdat box
            mdatbox = new Uint8Array(mdatBytes);
            // size field
            mdatbox[0] = (mdatBytes >>> 24) & 0xFF;
            mdatbox[1] = (mdatBytes >>> 16) & 0xFF;
            mdatbox[2] = (mdatBytes >>>  8) & 0xFF;
            mdatbox[3] = (mdatBytes) & 0xFF;
            // type field (fourCC)
            mdatbox.set(MP4.types.mdat, 4);
        }

        // Write samples into mdatbox
        for (let i = 0; i < mp4Samples.length; i++) {
            let unit = mp4Samples[i].unit;
            mdatbox.set(unit, offset);
            offset += unit.byteLength;
        }

        let latest = mp4Samples[mp4Samples.length - 1];
        lastDts = latest.dts + latest.duration;
        // console.log(latest.dts,latest.originalDts);
        // lastDts = latest.originalDts + latest.duration;
        this._audioNextDts = lastDts;
        // console.log('dtsCorrection',dtsCorrection,'firstSampleOriginalDts',firstSampleOriginalDts,'_dtsBase',this._dtsBase,'this._audioNextDts',this._audioNextDts,'latest.dts',latest.dts,latest.originalDts)

        // fill media segment info & add to info list
        let info = new MediaSegmentInfo();
        info.beginDts = firstDts;
        info.endDts = lastDts;
        info.beginPts = firstDts;
        info.endPts = lastDts;
        info.originalBeginDts = mp4Samples[0].originalDts;
        info.originalEndDts = latest.originalDts + latest.duration;
        info.firstSample = new SampleInfo(mp4Samples[0].dts,
                                          mp4Samples[0].pts,
                                          mp4Samples[0].duration,
                                          mp4Samples[0].originalDts,
                                          false);
        info.lastSample = new SampleInfo(latest.dts,
                                         latest.pts,
                                         latest.duration,
                                         latest.originalDts,
                                         false);
        if (!this._isLive) {
            this._audioSegmentInfoList.append(info);
        }

        track.samples = mp4Samples;
        track.sequenceNumber++;
        // track.sequenceNumber += track.addcoefficient;
        let moofbox = null;

        if (mpegRawTrack) {
            // Generate empty buffer, because useless for raw mpeg
            moofbox = new Uint8Array();
        } else {
            // Generate moof for fmp4 segment
            moofbox = MP4.moof(track, firstDts);
        }

        track.samples = [];
        track.length = 0;

        let segment = {
            type: 'audio',
            data: this._mergeBoxes(moofbox, mdatbox).buffer,
            sampleCount: mp4Samples.length,
            info: info
        };

        if (mpegRawTrack && firstSegmentAfterSeek) {
            // For MPEG audio stream in MSE, if seeking occurred, before appending new buffer
            // We need explicitly set timestampOffset to the desired point in timeline for mpeg SourceBuffer.
            segment.timestampOffset = firstDts;
        }

        this._onMediaSegment('audio', segment);
    }

    _remuxVideo(videoTrack) {
        if (this._videoMeta == null) {
            return;
        }

        let track = videoTrack;
        let samples = track.samples;
        let dtsCorrection = undefined;
        let firstDts = -1, lastDts = -1;
        let firstPts = -1, lastPts = -1;

        if (!samples || samples.length === 0) {
            return;
        }

        let offset = 8;
        let mdatBytes = 8 + videoTrack.length;
        let mdatbox = new Uint8Array(mdatBytes);
        mdatbox[0] = (mdatBytes >>> 24) & 0xFF;
        mdatbox[1] = (mdatBytes >>> 16) & 0xFF;
        mdatbox[2] = (mdatBytes >>>  8) & 0xFF;
        mdatbox[3] = (mdatBytes) & 0xFF;
        mdatbox.set(MP4.types.mdat, 4);

        let firstSampleOriginalDts = samples[0].dts - this._dtsBase;

        // calculate dtsCorrection
        if (this._videoNextDts) {
            dtsCorrection = firstSampleOriginalDts - this._videoNextDts;
        } else {  // this._videoNextDts == undefined
            if (this._videoSegmentInfoList.isEmpty()) {
                dtsCorrection = 0;
            } else {
                let lastSample = this._videoSegmentInfoList.getLastSampleBefore(firstSampleOriginalDts);
                if (lastSample != null) {
                    let distance = (firstSampleOriginalDts - (lastSample.originalDts + lastSample.duration));
                    if (distance <= 3) {
                        distance = 0;
                    }
                    let expectedDts = lastSample.dts + lastSample.duration + distance;
                    dtsCorrection = firstSampleOriginalDts - expectedDts;
                } else { // lastSample == null, cannot found
                    dtsCorrection = 0;
                }
            }
        }

        let info = new MediaSegmentInfo();
        let mp4Samples = [];

        // Correct dts for each sample, and calculate sample duration. Then output to mp4Samples
        for (let i = 0; i < samples.length; i++) {
            let sample = samples[i];
            let originalDts = sample.dts - this._dtsBase;
            let isKeyframe = sample.isKeyframe;
            let dts = originalDts - dtsCorrection;
            let cts = sample.cts;
            let pts = dts + cts;

            if (firstDts === -1) {
                firstDts = dts;
                firstPts = pts;
            }

            let sampleDuration = 0;

            if (i !== samples.length - 1) {
                let nextDts = samples[i + 1].dts - this._dtsBase - dtsCorrection;
                sampleDuration = nextDts - dts;
            } else {  // the last sample
                if (mp4Samples.length >= 1) {  // use second last sample duration
                    sampleDuration = mp4Samples[mp4Samples.length - 1].duration;
                } else {  // the only one sample, use reference sample duration
                    sampleDuration = Math.floor(this._videoMeta.refSampleDuration);
                }
            }

            if (isKeyframe) {
                let syncPoint = new SampleInfo(dts, pts, sampleDuration, sample.dts, true);
                syncPoint.fileposition = sample.fileposition;
                info.appendSyncPoint(syncPoint);
            }

            mp4Samples.push({
                dts: dts,
                pts: pts,
                cts: cts,
                units: sample.units,
                size: sample.length,
                isKeyframe: isKeyframe,
                duration: sampleDuration,
                originalDts: originalDts,
                flags: {
                    isLeading: 0,
                    dependsOn: isKeyframe ? 2 : 1,
                    isDependedOn: isKeyframe ? 1 : 0,
                    hasRedundancy: 0,
                    isNonSync: isKeyframe ? 0 : 1
                }
            });
        }

        // Write samples into mdatbox
        for (let i = 0; i < mp4Samples.length; i++) {
            let units = mp4Samples[i].units;
            while (units.length) {
                let unit = units.shift();
                let data = unit.data;
                mdatbox.set(data, offset);
                offset += data.byteLength;
            }
        }

        let latest = mp4Samples[mp4Samples.length - 1];
        lastDts = latest.dts + latest.duration;
        // lastDts = latest.originalDts + latest.duration;
        lastPts = latest.pts + latest.duration;
        this._videoNextDts = lastDts;

        // fill media segment info & add to info list
        info.beginDts = firstDts;
        info.endDts = lastDts;
        info.beginPts = firstPts;
        info.endPts = lastPts;
        info.originalBeginDts = mp4Samples[0].originalDts;
        info.originalEndDts = latest.originalDts + latest.duration;
        info.firstSample = new SampleInfo(mp4Samples[0].dts,
                                          mp4Samples[0].pts,
                                          mp4Samples[0].duration,
                                          mp4Samples[0].originalDts,
                                          mp4Samples[0].isKeyframe);
        info.lastSample = new SampleInfo(latest.dts,
                                         latest.pts,
                                         latest.duration,
                                         latest.originalDts,
                                         latest.isKeyframe);
        if (!this._isLive) {
            this._videoSegmentInfoList.append(info);
        }

        track.samples = mp4Samples;
        track.sequenceNumber++;
        // track.sequenceNumber += track.addcoefficient;

        // workaround for chrome < 50: force first sample as a random access point
        // see https://bugs.chromium.org/p/chromium/issues/detail?id=229412
        if (this._forceFirstIDR) {
            let flags = mp4Samples[0].flags;
            flags.dependsOn = 2;
            flags.isNonSync = 0;
        }

        let moofbox = MP4.moof(track, firstDts);
        track.samples = [];
        track.length = 0;

        this._onMediaSegment('video', {
            type: 'video',
            data: this._mergeBoxes(moofbox, mdatbox).buffer,
            sampleCount: mp4Samples.length,
            info: info
        });
    }

    _mergeBoxes(moof, mdat) {
        let result = new Uint8Array(moof.byteLength + mdat.byteLength);
        result.set(moof, 0);
        result.set(mdat, moof.byteLength);
        return result;
    }

}

/* eslint-disable */
class flv2fmp4 {

    /**
     * Creates an instance of flv2fmp4.
     * config 里面有_isLive属性,是否是直播
     * @param {any} config
     *
     * @memberof flv2fmp4
     */
    constructor(config) {
        this._config = { _isLive: false };
        this._config = Object.assign(this._config, config);

        // 外部方法赋值
        this.onInitSegment = null;
        this.onMediaSegment = null;
        this.onMediaInfo = null;
        this.seekCallBack = null;

        // 内部使用
        this.loadmetadata = false;
        this.ftyp_moov = null;//单路

        this.ftyp_moov_v=null;//双路视频
        this.ftyp_moov_a=null;//双路音频
        this.metaSuccRun = false;
        this.metas = [];
        this.parseChunk = null;
        this.hasVideo = false;
        this.hasAudio = false;
        this._error=null;
        // 临时记录seek时间
        this._pendingResolveSeekPoint = -1;

        // 临时记录flv数据起始时间
        this._tempBaseTime = 0;

        // 处理flv数据入口
        this.setflvBase = this.setflvBasefrist;

        tagdemux._onTrackMetadata = this.Metadata.bind(this);
        tagdemux._onMediaInfo = this.metaSucc.bind(this);
        tagdemux._onDataAvailable = this.onDataAvailable.bind(this);
        tagdemux._onError=this.error.bind(this);
        this.m4mof = new MP4Remuxer(this._config);
        this.m4mof.onMediaSegment = this.onMdiaSegment.bind(this);
    }
    seek(baseTime) {
        this.setflvBase = this.setflvBasefrist;
        if (baseTime == undefined || baseTime == 0) {
            baseTime = 0;
            this._pendingResolveSeekPoint = -1;
        }
        if (this._tempBaseTime != baseTime) {
            this._tempBaseTime = baseTime;
            tagdemux._timestampBase = baseTime;
            this.m4mof.seek(baseTime);
            this.m4mof.insertDiscontinuity();
            this._pendingResolveSeekPoint = baseTime;
        }
    }

    /**
     * 不要主动调用这个接口!!!!!!!!!!!!!!!!!!!!!!!!!!!!
     * 第一次接受数据,和seek时候接受数据入口,
     *
     * @param {any} arraybuff
     * @param {any} baseTime
     * @returns
     *
     * @memberof flv2fmp4
     */
    setflvBasefrist(arraybuff, baseTime) {

        let offset = 0;
        try {
            offset = flvparse.setFlv(new Uint8Array(arraybuff));
        } catch (error$$1) {
            this.error(error$$1);
        }
        if(flvparse.arrTag.length==0)return offset;
        if(flvparse.arrTag[0].type!=18){
            if(this.error)this.error(new Error('without metadata tag'));
        }
        if (flvparse.arrTag.length > 0) {
            tagdemux.hasAudio=this.hasAudio = flvparse._hasAudio;
            tagdemux.hasVideo=this.hasVideo = flvparse._hasVideo;
            
            if (this._tempBaseTime != 0 && this._tempBaseTime == flvparse.arrTag[0].getTime()) {
                tagdemux._timestampBase = 0;
            }
            try {
                tagdemux.moofTag(flvparse.arrTag);
            } catch (error$$1) {
                this.error(error$$1);
            }
            this.setflvBase = this.setflvBaseUsually;
        }

        return offset;
    }

    /**
     * 不要主动调用这个接口!!!!!!!!!!!!!!!!!!!!!!!!!!!!
     * 后续接受数据接口
     * @param {any} arraybuff
     * @param {any} baseTime
     * @returns
     *
     * @memberof flv2fmp4
     */
    setflvBaseUsually(arraybuff, baseTime) {
        let offset =0;
        try {
            offset = flvparse.setFlv(new Uint8Array(arraybuff));
        } catch (error$$1) {
            this.error(error$$1);
        }
        if (flvparse.arrTag.length > 0) {
            try {
                tagdemux.moofTag(flvparse.arrTag);
            } catch (error$$1) {
                this.error(error$$1);
            }
        }

        return offset;
    }

    /**
     * 不要主动调用这个接口!!!!!!!!!!!!!!!!!!!!!!!!!!!!
     * moof回调
     *
     * @param {any} track
     * @param {any} value
     *
     * @memberof flv2fmp4
     */
    onMdiaSegment(track, value) {

        if (this.onMediaSegment) {
            this.onMediaSegment(track,new Uint8Array(value.data));
        }
        if (this._pendingResolveSeekPoint != -1 && track == 'video') {
            let seekpoint = this._pendingResolveSeekPoint;
            this._pendingResolveSeekPoint = -1;
            if (this.seekCallBack) {
                this.seekCallBack(seekpoint);
            }
        }
    }

    /**
     *
     * 音频和视频的初始化tag
     *
     * @param {any} type
     * @param {any} meta
     *
     * @memberof flv2fmp4
     */
    Metadata(type, meta) {
        switch (type) {
            case 'video':
                this.metas.push(['video',meta]);
                this.m4mof._videoMeta = meta;
                if (this.hasVideo && !this.hasAudio) {
                    this.metaSucc();
                    return;
                }
                break;
            case 'audio':
                this.metas.push(['audio',meta]);
                this.m4mof._audioMeta = meta;
                if (!this.hasVideo && this.hasAudio) {
                    this.metaSucc();
                    return;
                }
                break;
        }
        if (this.hasVideo && this.hasAudio  && this.metas.length > 1) {
            this.metaSucc();
        }
    }

    /**
     * metadata解读成功后触发及第一个视频tag和第一个音频tag
     *
     * @param {any} mi
     * @returns
     *
     * @memberof flv2fmp4
     */
    metaSucc(mi) {
        if (this.onMediaInfo) {
            this.onMediaInfo(mi||tagdemux._mediaInfo, { hasAudio: this.hasAudio, hasVideo: this.hasVideo });
        }
        // 获取ftyp和moov
        if (this.metas.length == 0) {
            this.metaSuccRun = true;
            return;
        }
        if(mi)return;
        if(this.metas.length>1){
            // this.ftyp_moov_v=
            this.metas.map(item=>{
                if(item[0]=='video'){
                    this.ftyp_moov_v=MP4.generateInitSegment([item[1]]);
                }else{
                    this.ftyp_moov_a=MP4.generateInitSegment([item[1]]);
                }
            });
        }else{
            this.ftyp_moov = MP4.generateInitSegment([this.metas[0][1]]);
        }
        
        if (this.onInitSegment && this.loadmetadata == false) {

            if(this.ftyp_moov)
            {
                this.onInitSegment(this.ftyp_moov);
            }else{
                this.onInitSegment(this.ftyp_moov_v,this.ftyp_moov_a);
            }
            this.loadmetadata = true;
        }
    }

    onDataAvailable(audiotrack, videotrack) {
        // this.m4mof.remux(audiotrack, videotrack);

        try{
            this.m4mof.remux(audiotrack, videotrack);
        }catch(e){
            this.error(e);
        }
    }

    /**
     * 传入flv的二进制数据
     * 统一入口
     * @param {any} arraybuff
     * @param {any} baseTime flv数据开始时间
     * @returns
     *
     * @memberof flv2fmp4
     */
    setflv(arraybuff, baseTime) {
        return this.setflvBase(arraybuff, baseTime);
    }

    /**
     *
     * 本地调试代码,不用理会
     * @param {any} arraybuff
     * @returns
     *
     * @memberof flv2fmp4
     */
    setflvloc(arraybuff) {
        const offset = flvparse.setFlv(new Uint8Array(arraybuff));

        if (flvparse.arrTag.length > 0) {
            return flvparse.arrTag;
        }
    }
    /**
     * 
     *  异常抛出处理
     * @param {any} e 
     * @memberof flv2fmp4
     */
    error(e) {
        if(this._error){
            this._error(e);
        }
    }
}

/**
 * 封装的对外类,有些方法不想对外暴露,所以封装这么一个类
 *
 * @class foreign
 */
class foreign extends CustEvent {
    constructor(config) {
        super();
        this.f2m = new flv2fmp4(config);
        this.f2m._error=this.error;
        // 外部方法赋值
        this._onInitSegment = null;
        this._onMediaSegment = null;
        this._onMediaInfo = null;
        this._seekCallBack = null;
    }
    error(e){
        this.emit('error',e.type);
    }
    /**
     *
     * 跳转
     * @param {any} basetime  跳转时间
     *
     * @memberof foreign
     */
    seek(basetime) {
        this.f2m.seek(basetime);
    }

    /**
     * 传入flv的二进制数据
     * 统一入口
     * @param {any} arraybuff
     * @returns
     *
     * @memberof flv2fmp4
     */
    setflv(arraybuff) {
        return this.f2m.setflv(arraybuff, 0);
    }

    /**
     *
     * 本地调试代码,不用理会
     * @param {any} arraybuff
     * @returns
     *
     * @memberof flv2fmp4
     */
    setflvloc(arraybuff) {
        return this.f2m.setflvloc(arraybuff);
    }

    /**
     * 赋值初始化seg接受方法
     *
     *
     * @memberof foreign
     */
    set onInitSegment(fun) {
        this._onInitSegment = fun;
        this.f2m.onInitSegment = fun;
    }

    /**
     * 赋值moof接受方法
     *
     *
     * @memberof foreign
     */
    set onMediaSegment(fun) {
        this._onMediaSegment = fun;
        this.f2m.onMediaSegment = fun;
    }

    /**
     * 赋值metadata接受方法
     *
     *
     * @memberof foreign
     */
    set onMediaInfo(fun) {
        this._onMediaInfo = fun;
        this.f2m.onMediaInfo = fun;
    }

    /**
     * 赋值是否跳转回调接受方法
     *
     *
     * @memberof foreign
     */
    set seekCallBack(fun) {
        this._seekCallBack = fun;
        this.f2m.seekCallBack = fun;
    }
}

export default foreign;
