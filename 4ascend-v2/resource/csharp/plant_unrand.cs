// ttr.TTRPlant
// Token: 0x060001A1 RID: 417 RVA: 0x00013588 File Offset: 0x00011788
public bool createPlant(bool after_attacking, int count, bool first_ovr_execute)
{
	this.ABuf.Clear();
	this.ABufOv.Clear();
	int num = 0;
	TST current_tst_type = this.TTR.current_tst_type;
	TST tst = ((current_tst_type == TST.PR0) ? TST.PR1 : TST.PR0);
	int num2 = ((current_tst_type == TST.PR0) ? 0 : 1);
	bool flag = this.Aunascend_charge_fast[num2] > 0;
	bool flag2 = this.Aunascend_charge_fast[1 - num2] > 0;
	bool flag3 = after_attacking;
	bool flag4 = after_attacking && this.unascend_charge <= 0;
	if (this.Aunascend_charge_fast[num2] > 0)
	{
		after_attacking = false;
	}
	TST tst2 = ((this.Aunascend_charge_fast[0] == 0) ? TST.ASCEND_PR0 : TST.NONE) | ((this.Aunascend_charge_fast[1] == 0) ? TST.ASCEND_PR1 : TST.NONE);
	if (tst2 == TST.NONE)
	{
		tst2 = TST._FILL;
	}
	TST tst3 = tst2;
	for (int i = 0; i < 2; i++)
	{
		for (int j = 0; j < 9; j++)
		{
			for (int k = 0; k < 9; k++)
			{
				TTRPoint ttrpoint = this.PD[k, j];
				if (flag3 ? ((ttrpoint.d & tst3) != TST.NONE || (ttrpoint.filled && (flag4 || this.over_filled > 0))) : ttrpoint.filled)
				{
					for (int l = (flag3 ? (-1) : 0); l < 8; l++)
					{
						TTRPoint ttrpoint2;
						if (this.PD.Get(out ttrpoint2, k, j, (AIM)l, 1) && !ttrpoint2.filled && !ttrpoint2.plant_filled)
						{
							ttrpoint2.d |= TST._PLANT_ENABLE;
							num++;
						}
					}
				}
			}
		}
		if (num != 0 || !flag3)
		{
			break;
		}
		tst3 |= TST._ASCEND_FILL;
	}
	if ((this.over_filled & this.OVR_EXECUTE) != 0)
	{
		count++;
	}
	count = X.Mn(count, num);
	if (count <= 0)
	{
		return false;
	}
	uint num3 = 0U;
	using (AlignCon alignCon = this.PD.PopAlignData())
	{
		using (AlignCon alignCon2 = this.PD.PopAlignData())
		{
			for (int m = 0; m < 9; m++)
			{
				for (int n = 0; n < 9; n++)
				{
					TTRPoint ttrpoint3 = this.PD[n, m];
					if ((ttrpoint3.d & TST._PLANT_ENABLE) != TST.NONE)
					{
						int num4 = 500;
						bool flag5 = false;
						this.PD.RecalcAlignData(ttrpoint3, current_tst_type, alignCon, ALC_OPT.NONE, 255U);
						this.PD.RecalcAlignData(ttrpoint3, tst, alignCon2, ALC_OPT.NONE, 255U);
						bool flag6 = after_attacking || first_ovr_execute;
						uint num5 = 0U;
						if (alignCon.max_align >= 4 || alignCon2.max_align >= 4)
						{
							if ((this.over_filled & this.OVR_EXECUTE) != 0)
							{
								uint num6 = 0U;
								if (alignCon.max_align < 4 && !flag2)
								{
									num6 |= 2U;
								}
								if (alignCon2.max_align < 4 && !flag)
								{
									num6 |= 1U;
								}
								if (num6 == 1U || num6 == 2U)
								{
									num4 += 450 + (ttrpoint3.plant_exist ? 0 : 100);
									if (num6 == 1U || first_ovr_execute)
									{
										flag6 = true;
									}
									num5 = num6;
								}
							}
							num4 -= 450;
						}
						if (flag6)
						{
							if (alignCon.max_align_total < alignCon2.max_align_total)
							{
								num4 -= X.Abs(alignCon.max_align_total - alignCon2.max_align_total) * 3;
							}
							if (alignCon.max_align < alignCon2.max_align)
							{
								num4 -= X.Abs(alignCon.max_align - alignCon2.max_align) * 15;
							}
							if (alignCon.max_align == 3 && alignCon2.max_align <= 1)
							{
								if (flag4)
								{
									flag5 = true;
								}
								else
								{
									num4 += (int)(X.ZSIN((float)(25 - this.unascend_charge), 25f) * 120f);
								}
							}
						}
						else
						{
							if ((alignCon.max_align_total > alignCon2.max_align_total && !flag && flag2) || (alignCon.max_align_total < alignCon2.max_align_total && flag && !flag2))
							{
								num4 += X.Abs(alignCon.max_align_total - alignCon2.max_align_total) * 6;
							}
							else if (alignCon.max_align_total != alignCon2.max_align_total)
							{
								num4 -= X.Abs(alignCon.max_align_total - alignCon2.max_align_total) * 3;
							}
							if (alignCon.max_align != alignCon2.max_align)
							{
								num4 -= X.Abs(alignCon.max_align - alignCon2.max_align) * 15;
							}
						}
						if (ttrpoint3.plant_exist && !flag4)
						{
							num4 -= 30;
						}
						else if (after_attacking && (ttrpoint3.d & tst2) != TST.NONE)
						{
							num4 += 50;
						}
						if (num5 > 0U)
						{
							num3 |= num5;
							this.ABufOv.Add(new TTRPlant.PtScore(ttrpoint3, num4, (byte)num5));
						}
						else
						{
							this.ABuf.Add(new TTRPlant.PtScore(ttrpoint3, num4, 0));
							if (flag5)
							{
								count++;
								this.ABuf.Add(new TTRPlant.PtScore(ttrpoint3, num4 + 30, 0));
							}
						}
					}
				}
			}
		}
	}
	if (num3 > 0U)
	{
		// X.shuffle<TTRPlant.PtScore>(this.ABufOv, -1, null);
		int count2 = this.ABufOv.Count;
		int num7 = 0;
		while (num7 < count2 && num3 > 0U)
		{
			TTRPlant.PtScore ptScore = this.ABufOv[num7];
			uint ovr_bits = (uint)ptScore.ovr_bits;
			if ((num3 & ovr_bits) != 0U)
			{
				num3 &= ~ovr_bits;
				count++;
				this.ABuf.Add(ptScore);
				this.ABuf.Add(new TTRPlant.PtScore(ptScore.Pos, ptScore.score + 40, ptScore.ovr_bits));
			}
			num7++;
		}
	}
	// X.shuffle<TTRPlant.PtScore>(this.ABuf, -1, null);
	this.ABuf.Sort((TTRPlant.PtScore A, TTRPlant.PtScore B) => TTRPlant.PtScore.Sort(A, B));
	count = X.Mn(count, 6);
	int num8 = count;
	int num9 = 0;
	while (num9 < this.ABuf.Count && count > 0)
	{
		TTRPlant.PtScore ptScore2 = this.ABuf[num9];
		if (this.createPlant(ptScore2.Pos, true))
		{
			count--;
			if ((ptScore2.ovr_bits & 1) != 0)
			{
				this.Aunascend_charge_fast[num2] = X.Mx(this.Aunascend_charge_fast[num2], 4);
			}
			if ((ptScore2.ovr_bits & 2) != 0)
			{
				this.Aunascend_charge_fast[1 - num2] = X.Mx(this.Aunascend_charge_fast[1 - num2], 4);
			}
		}
		num9++;
	}
	this.plantSort();
	this.TTR.ONL.playCheckPlantCreated(this.ABuf, num8);
	for (int num10 = this.ABuf.Count - 1; num10 >= 0; num10--)
	{
		this.ABuf[num10].Pos.d &= (TST)4294967231U;
	}
	return true;
}
