using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using PixelLiner.PixelLinerLib;

namespace XX
{
	// Token: 0x02000286 RID: 646
	public class XorsMaker
	{
		// Token: 0x06002C82 RID: 11394 RVA: 0x0012658F File Offset: 0x0012478F
		public XorsMaker(bool use_save)
		{
			this.Randseed = new uint[4];
			this.randA = new uint[128];
			if (use_save)
			{
				this.RandseedFirst = new uint[4];
			}
		}

		// Token: 0x06002C83 RID: 11395 RVA: 0x001265C2 File Offset: 0x001247C2
		public XorsMaker(uint randseedset = 0U, bool use_save = false)
			: this(use_save)
		{
			this.init(false, randseedset, 0U, 0U, 0U);
		}

		// Token: 0x06002C84 RID: 11396 RVA: 0x001265D7 File Offset: 0x001247D7
		public XorsMaker(uint randseedset0, uint randseedset1, uint randseedset2, uint randseedset3, bool use_save = false)
			: this(use_save)
		{
			this.init(false, randseedset0, randseedset1, randseedset2, randseedset3);
		}

		// Token: 0x06002C85 RID: 11397 RVA: 0x001265EE File Offset: 0x001247EE
		public XorsMaker(ByteArray Ba)
			: this(true)
		{
			this.readBinaryFrom(Ba, false);
		}

		// Token: 0x06002C86 RID: 11398 RVA: 0x001265FF File Offset: 0x001247FF
		public void reset(bool no_clear_randA = true)
		{
			if (this.RandseedFirst != null)
			{
				this.init(this.RandseedFirst, no_clear_randA);
			}
		}

		// Token: 0x06002C87 RID: 11399 RVA: 0x00126618 File Offset: 0x00124818
		public void updateFirst(int skip_first = 0)
		{
			if (this.RandseedFirst != null)
			{
				while (--skip_first >= 0)
				{
					this.get0();
				}
				this.init(false, this.Randseed[0], this.Randseed[1], this.Randseed[2], this.Randseed[3]);
			}
		}

		// Token: 0x06002C88 RID: 11400 RVA: 0x00126668 File Offset: 0x00124868
		public uint init(bool noClearRandA = false, uint randseedset = 0U, uint randseedset1 = 0U, uint randseedset2 = 0U, uint randseedset3 = 0U)
		{
			DateTime now = DateTime.Now;
			uint num;
			if (randseedset != 0U)
			{
				num = randseedset;
			}
			else
			{
				uint num2 = (uint)(now.Ticks / 10000L);
				uint num3 = this.times;
				this.times = num3 + 1U;
				num = num2 + num3;
			}
			randseedset = num;
			this.Randseed[0] = randseedset;
			this.Randseed[1] = ((randseedset1 != 0U) ? randseedset1 : (this.Randseed[0] + 123456789U));
			this.Randseed[2] = ((randseedset2 != 0U) ? randseedset2 : (this.Randseed[0] + 362436069U));
			this.Randseed[3] = ((randseedset3 != 0U) ? randseedset3 : (this.Randseed[0] + 521288629U));
			if (this.RandseedFirst != null)
			{
				Array.Copy(this.Randseed, this.RandseedFirst, 4);
			}
			if (!noClearRandA)
			{
				this.clearRandA();
			}
			return randseedset;
		}

		// Token: 0x06002C89 RID: 11401 RVA: 0x00126729 File Offset: 0x00124929
		public uint init(uint[] Arandseed, bool noClearRandA = true)
		{
			return this.init(noClearRandA, Arandseed[0], Arandseed[1], Arandseed[2], Arandseed[3]);
		}

		// Token: 0x06002C8A RID: 11402 RVA: 0x00126740 File Offset: 0x00124940
		public void clearRandA()
		{
			this.get0();
			this.get0();
			this.get0();
			this.get0();
			for (uint num = 0U; num < 128U; num += 1U)
			{
				this.randA[(int)num] = this.get0();
			}
		}

		// Token: 0x06002C8B RID: 11403 RVA: 0x00126787 File Offset: 0x00124987
		public float XORSP()
		{
			this.Bytes.In = (this.get0() >> 9) | 1065353216U;
			return this.Bytes.Out - 1f;
		}

		// Token: 0x06002C8C RID: 11404 RVA: 0x001267B4 File Offset: 0x001249B4
		public uint get0()
		{
			uint num = this.Randseed[0] ^ (this.Randseed[0] << 11);
			this.Randseed[0] = this.Randseed[1];
			this.Randseed[1] = this.Randseed[2];
			this.Randseed[2] = this.Randseed[3];
			return this.Randseed[3] = this.Randseed[3] ^ (this.Randseed[3] >> 19) ^ (num ^ (num >> 8));
		}

		// Token: 0x06002C8D RID: 11405 RVA: 0x0012682B File Offset: 0x00124A2B
		public uint get2(uint seed1, uint seed2)
		{
			return (this.randA[(int)(seed1 & 63U)] ^ this.randA[(int)(64U + ((seed2 * 137U + 69U) & 63U))]) & 134217727U;
		}

		// Token: 0x06002C8E RID: 11406 RVA: 0x00126856 File Offset: 0x00124A56
		public uint get2O(uint seed1, uint seed2)
		{
			return (this.randA[(int)(seed1 & 127U)] / ((seed2 & 65535U) + 1U)) & 134217727U;
		}

		// Token: 0x06002C8F RID: 11407 RVA: 0x00126873 File Offset: 0x00124A73
		public int xors(int i)
		{
			if (i > 0)
			{
				return (int)(this.get0() % (uint)i);
			}
			return 0;
		}

		// Token: 0x06002C90 RID: 11408 RVA: 0x00126884 File Offset: 0x00124A84
		public int map(int l0, int l1 = 0, int l2 = 0, int l3 = 0, int l4 = 0)
		{
			int num = this.xors(l0 + l1 + l2 + l3 + l4);
			if (num < l0)
			{
				return 0;
			}
			if (num < l0 + l1)
			{
				return 1;
			}
			if (num < l0 + l1 + l2)
			{
				return 2;
			}
			if (num < l0 + l1 + l2 + l3)
			{
				return 3;
			}
			return 4;
		}

		// Token: 0x06002C91 RID: 11409 RVA: 0x001268CC File Offset: 0x00124ACC
		public uint comb_bits(int va, int vb)
		{
			if (vb <= 0 || va <= 0)
			{
				return 0U;
			}
			if (vb >= va)
			{
				return (1U << va) - 1U;
			}
			uint num = 0U;
			while (--vb >= 0)
			{
				int num2 = (int)((this.get0() & 2147483647U) % (uint)va);
				int num3 = 0;
				while (num3 < va && (num & (1U << num2)) != 0U)
				{
					num2 = (num2 + 1) % va;
					num3++;
				}
				num |= 1U << num2;
			}
			return num;
		}

		// Token: 0x06002C92 RID: 11410 RVA: 0x00126934 File Offset: 0x00124B34
		public void shuffle<T>(T[] A, int arraymax = -1)
		{
			arraymax = ((arraymax < 0) ? A.Length : arraymax);
			int num = (arraymax - 1) * 23;
			for (int i = 0; i < num; i++)
			{
				int num2 = (int)((ulong)this.get0() % (ulong)((long)arraymax));
				int num3 = (int)((ulong)this.get0() % (ulong)((long)arraymax));
				int num4 = num2;
				int num5 = num3;
				T t = A[num3];
				T t2 = A[num2];
				A[num4] = t;
				A[num5] = t2;
			}
		}

		// Token: 0x06002C93 RID: 11411 RVA: 0x001269A8 File Offset: 0x00124BA8
		public void shuffle<T>(List<T> A, int arraymax = -1)
		{
			arraymax = ((arraymax < 0) ? A.Count : arraymax);
			int num = (arraymax - 1) * 23;
			for (int i = 0; i < num; i++)
			{
				int num2 = (int)((ulong)this.get0() % (ulong)((long)arraymax));
				int num3 = (int)((ulong)this.get0() % (ulong)((long)arraymax));
				int num4 = num2;
				int num5 = num3;
				T t = A[num3];
				T t2 = A[num2];
				A[num4] = t;
				A[num5] = t2;
			}
		}

		// Token: 0x06002C94 RID: 11412 RVA: 0x00126A28 File Offset: 0x00124C28
		public XorsMaker saveRandSeeds(uint[] Av)
		{
			if (this.RandseedFirst == null)
			{
				X.de("正しい保存結果を得るには use_save をオンにして作成する必要があります", null);
				Av[0] = this.Randseed[0];
				Av[1] = this.Randseed[1];
				Av[2] = this.Randseed[2];
				Av[3] = this.Randseed[3];
			}
			else
			{
				Av[0] = this.RandseedFirst[0];
				Av[1] = this.RandseedFirst[1];
				Av[2] = this.RandseedFirst[2];
				Av[3] = this.RandseedFirst[3];
			}
			return this;
		}

		// Token: 0x06002C95 RID: 11413 RVA: 0x00126AA4 File Offset: 0x00124CA4
		public virtual void readBinaryFrom(ByteReader Ba, bool noClearRandA = false)
		{
			if (this.RandseedFirst == null)
			{
				this.RandseedFirst = new uint[4];
			}
			this.RandseedFirst[0] = (this.Randseed[0] = Ba.readUInt());
			this.RandseedFirst[1] = (this.Randseed[1] = Ba.readUInt());
			this.RandseedFirst[2] = (this.Randseed[2] = Ba.readUInt());
			this.RandseedFirst[3] = (this.Randseed[3] = Ba.readUInt());
			if (!noClearRandA)
			{
				this.clearRandA();
			}
		}

		// Token: 0x06002C96 RID: 11414 RVA: 0x00126B34 File Offset: 0x00124D34
		public virtual void writeBinaryTo(ByteArray Ba)
		{
			if (this.RandseedFirst == null)
			{
				X.de("正しい保存結果を得るには use_save をオンにして作成する必要があります", null);
				Ba.writeUInt(this.Randseed[0]);
				Ba.writeUInt(this.Randseed[1]);
				Ba.writeUInt(this.Randseed[2]);
				Ba.writeUInt(this.Randseed[3]);
				return;
			}
			Ba.writeUInt(this.RandseedFirst[0]);
			Ba.writeUInt(this.RandseedFirst[1]);
			Ba.writeUInt(this.RandseedFirst[2]);
			Ba.writeUInt(this.RandseedFirst[3]);
		}

		// Token: 0x04001B10 RID: 6928
		private uint times;

		// Token: 0x04001B11 RID: 6929
		private uint[] Randseed;

		// Token: 0x04001B12 RID: 6930
		public uint[] randA;

		// Token: 0x04001B13 RID: 6931
		private uint[] RandseedFirst;

		// Token: 0x04001B14 RID: 6932
		private XorsMaker.UnionBytes Bytes;

		// Token: 0x04001B15 RID: 6933
		public const int binary_count = 16;

		// Token: 0x0200041C RID: 1052
		[StructLayout(LayoutKind.Explicit)]
		private struct UnionBytes
		{
			// Token: 0x040024BD RID: 9405
			[FieldOffset(0)]
			public float Out;

			// Token: 0x040024BE RID: 9406
			[FieldOffset(0)]
			public uint In;
		}
	}
}
