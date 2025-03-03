import { BinanceOrder, PaginatedResponse } from '../types/orders';

declare global {
    interface Window {
        CryptoJS: any;
    }
}

export class BinanceService {
    private baseUrl = 'https://api.binance.com';
    private proxyUrl = 'https://cors-proxy.fringe.zone/';
    private apiKey: string;
    private secretKey: string;
    private recvWindow = 60000;
    private startTime?: number;
    private endTime?: number;

    constructor(apiKey: string, secretKey: string) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
    }

    setDateRange(startTime?: number, endTime?: number) {
        if (startTime) {
            // تحويل التاريخ إلى توقيت UTC
            const startDate = new Date(startTime);
            startDate.setHours(startDate.getHours() - 4); // تعويض فرق التوقيت
            this.startTime = startDate.getTime();
        } else {
            this.startTime = undefined;
        }

        if (endTime) {
            // تحويل التاريخ إلى توقيت UTC
            const endDate = new Date(endTime);
            endDate.setHours(endDate.getHours() - 4); // تعويض فرق التوقيت
            this.endTime = endDate.getTime();
        } else {
            this.endTime = undefined;
        }
    }

    async checkServerTime(): Promise<number> {
        try {
            const response = await fetch(`${this.proxyUrl}${this.baseUrl}/api/v3/time`);
            if (!response.ok) {
                throw new Error(`خطأ في الاتصال: ${response.status}`);
            }
            const data = await response.json();
            return data.serverTime;
        } catch (error) {
            console.error('خطأ في الحصول على وقت السيرفر:', error);
            throw new Error('فشل الاتصال مع سيرفر Binance');
        }
    }

    private async validateTimestamp(timestamp: number): Promise<boolean> {
        try {
            const serverTime = await this.checkServerTime();
            const diff = Math.abs(serverTime - timestamp);
            return diff <= this.recvWindow;
        } catch {
            return true;
        }
    }

    async getP2POrders(page: number = 1, limit: number = 100): Promise<PaginatedResponse> {
        try {
            const timestamp = Date.now();
            await this.validateTimestamp(timestamp);

            console.log('=== Debug Timestamps ===');
            console.log('Start Time (raw):', this.startTime);
            console.log('End Time (raw):', this.endTime);
            console.log('Start Time (date):', this.startTime ? new Date(this.startTime).toISOString() : null);
            console.log('End Time (date):', this.endTime ? new Date(this.endTime).toISOString() : null);

            const queryParams = new URLSearchParams({
                timestamp: timestamp.toString(),
                recvWindow: this.recvWindow.toString(),
                page: page.toString(),
                rows: limit.toString()
            });

            // إرسال التواريخ كما هي بدون معالجة
            if (this.startTime) {
                queryParams.append('startTime', this.startTime.toString());
            }
            if (this.endTime) {
                queryParams.append('endTime', this.endTime.toString());
            }

            const signature = window.CryptoJS.HmacSHA256(queryParams.toString(), this.secretKey).toString();
            queryParams.append('signature', signature);

            const url = `${this.proxyUrl}${this.baseUrl}/sapi/v1/c2c/orderMatch/listUserOrderHistory?${queryParams.toString()}`;
            console.log('=== Debug Request ===');
            console.log('Request URL:', url);
            console.log('Query Params:', Object.fromEntries(queryParams.entries()));
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-MBX-APIKEY': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error Response:', errorData);
                if (response.status === 429) {
                    throw new Error('تم تجاوز حد الطلبات المسموح به');
                } else if (response.status === 418) {
                    throw new Error('تم حظر عنوان IP الخاص بك');
                }
                throw new Error(errorData.msg || 'خطأ في جلب الأوردرات');
            }

            const data = await response.json();
            console.log('=== Debug Response ===');
            console.log('Raw Response:', data);

            if (!data || !Array.isArray(data.data)) {
                console.error('شكل البيانات غير صحيح:', data);
                throw new Error('البيانات المستلمة غير صالحة');
            }

            // تحويل الأوردرات وطباعة التواريخ للتحقق
            const transformedOrders = this.transformOrders(data.data);
            console.log('=== Debug Orders ===');
            console.log('First Order Time:', transformedOrders[0]?.createTime ? new Date(transformedOrders[0].createTime).toISOString() : null);
            console.log('Last Order Time:', transformedOrders[transformedOrders.length - 1]?.createTime ? 
                new Date(transformedOrders[transformedOrders.length - 1].createTime).toISOString() : null);

            const total = data.total || data.data.length;
            const totalPages = Math.ceil(total / limit);

            return {
                total,
                orders: transformedOrders,
                currentPage: page,
                totalPages
            };

        } catch (error) {
            console.error('خطأ في getP2POrders:', error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('حدث خطأ غير متوقع');
        }
    }

    private transformOrders(data: any[]): BinanceOrder[] {
        // تحويل الأوردرات
        const orders = data.map(order => {
            const cryptoAmount = this.parseNumber(order.amount);
            const isTakerOrder = order.commission === 0;
            const fee = isTakerOrder ? 0.05 : this.parseNumber(order.commission);
            
            const actualUsdt = order.tradeType === 'BUY' ? 
                cryptoAmount - (isTakerOrder ? 0.05 : fee) :
                cryptoAmount + (isTakerOrder ? 0.05 : fee);

            // نستخدم التاريخ كما هو من بينانس بدون تعديل
            const transformedOrder: BinanceOrder = {
                orderId: order.orderNumber,
                type: order.tradeType as 'BUY' | 'SELL',
                fiatAmount: this.parseNumber(order.totalPrice),
                price: this.parseNumber(order.unitPrice),
                cryptoAmount: cryptoAmount,
                fee: fee,
                netAmount: cryptoAmount,
                actualUsdt: actualUsdt,
                status: this.mapOrderStatus(order.orderStatus),
                createTime: order.createTime
            };
            return transformedOrder;
        });

        // ترتيب الأوردرات تصاعدياً حسب التاريخ (من الأقدم للأحدث)
        return orders.sort((a, b) => a.createTime - b.createTime);
    }

    private parseNumber(value: any): number {
        if (value === undefined || value === null) {
            throw new Error('القيمة غير موجودة');
        }
        
        // تحويل القيمة لـ string للتأكد من معالجة الأرقام العشرية بشكل صحيح
        const strValue = value.toString().trim();
        
        // إزالة أي رموز غير رقمية ما عدا النقطة العشرية والسالب
        const cleanValue = strValue.replace(/[^0-9.-]/g, '');
        
        // التحويل لرقم مع الحفاظ على الأرقام بعد العلامة العشرية
        const num = Number(cleanValue);
        
        if (isNaN(num)) {
            throw new Error('القيمة ليست رقماً صالحاً');
        }
        
        // التأكد من أن الرقم ليس undefined أو NaN
        return num === 0 ? 0 : num || 0;
    }

    private mapOrderStatus(status: string): 'COMPLETED' | 'CANCELLED' | 'PENDING' {
        if (!status) return 'PENDING';
        
        const normalizedStatus = status.toString().toUpperCase();
        
        if (normalizedStatus.includes('COMPLET') || normalizedStatus.includes('SUCCESS')) {
            return 'COMPLETED';
        }
        if (normalizedStatus.includes('CANCEL') || normalizedStatus.includes('FAIL')) {
            return 'CANCELLED';
        }
        return 'PENDING';
    }
}
