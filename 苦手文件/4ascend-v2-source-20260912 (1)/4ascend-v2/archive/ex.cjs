/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const BaseZalgo = require('../js/global/utils/basezalgo.cjs').BaseZalgo;

const ArchiveOld = require('./archive_old_v2.cjs').Archive;
const ArchiveNew = require('../js/global/fascend/archive.cjs').ArchiveV0;

window.ArchiveOld = ArchiveOld;
window.ArchiveNew = ArchiveNew;
window.BaseZalgo = BaseZalgo;