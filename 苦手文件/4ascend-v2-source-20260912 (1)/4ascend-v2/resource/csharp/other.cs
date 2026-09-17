public static float ZSIN(float num, float _mx)
{
    if (num <= 0f)
    {
        return 0f;
    }
    if (num < _mx)
    {
        return X.Sin(X.MMX(0f, num / _mx, 1f) * 0.5f * 3.1415927f);
    }
    return 1f;
}



public static float MMX(float minnum, float thenum, float maxnum)
{
    return X.Mx(minnum, X.Mn(thenum, maxnum));
}


public static float Sin(float x)
{
    if (x != 0f)
    {
        return X.Cos(x - 1.5707964f);
    }
    return 0f;
}


public static float Cos(float x)
{
    float num = 1f;
    if (x < 0f)
    {
        x = -x;
    }
    x -= (float)((int)(x * 0.31830987f * 0.5f)) * 6.2831855f;
    if (x >= 3.1415927f)
    {
        x = 6.2831855f - x;
    }
    if (x >= 1.5707964f)
    {
        x = 3.1415927f - x;
        num = -1f;
    }
    if (x > 0.7853982f)
    {
        x = 1.5707964f - x;
        float num2 = x * x;
        return x * (1f - num2 * 0.16666667f + num2 * num2 * 0.008333334f) * num;
    }
    float num3 = x * x;
    return (1f - num3 * 0.5f + num3 * num3 * 0.041666668f - num3 * num3 * num3 * 0.0013888889f) * num;
}


public static int xors(int i)
{
    if (i != 1 && i != 0)
    {
        return X.Xors.xors(i);
    }
    return 0;
}


public static void shuffle<T>(List<T> A, int arraymax = -1, XorsMaker Xors = null)
{
    arraymax = ((arraymax < 0) ? A.Count : arraymax);
    int num = (arraymax - 1) * 23;
    for (int i = 0; i < num; i++)
    {
        int num2 = ((Xors != null) ? ((int)((ulong)Xors.get0() % (ulong)((long)arraymax))) : Random.Range(0, arraymax));
        int num3 = ((Xors != null) ? ((int)((ulong)Xors.get0() % (ulong)((long)arraymax))) : Random.Range(0, arraymax));
        int num4 = num2;
        int num5 = num3;
        T t = A[num3];
        T t2 = A[num2];
        A[num4] = t;
        A[num5] = t2;
    }
}