import React, { useState, useEffect } from 'react';
import { BinanceService } from '../services/binanceService';
import { BinanceOrder, SavedCredential } from '../types/orders';

export const BinanceTab: React.FC = () => {
    const [orders, setOrders] = useState<BinanceOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [orderType, setOrderType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
    const [orderStatus, setOrderStatus] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
    const [orderFeeType, setOrderFeeType] = useState<'ALL' | 'MAKER' | 'TAKER'>('ALL');
    const [filteredOrders, setFilteredOrders] = useState<BinanceOrder[]>([]);
    
    // إضافة حالات جديدة للصفحات
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);
    
    // إضافة حالات جديدة لنظام حفظ المفاتيح
    const [savedCredentials, setSavedCredentials] = useState<SavedCredential[]>([]);
    const [credentialName, setCredentialName] = useState<string>('');
    const [selectedCredential, setSelectedCredential] = useState<string>('');
    const [showSaveForm, setShowSaveForm] = useState<boolean>(false);
    
    // إضافة حالة جديدة للتحكم في ظهور قسم الفلترة
    const [isConnected, setIsConnected] = useState<boolean>(false);
    
    // حالة التحميل الموحدة
    const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'loadingMore'>('idle');

    // استرجاع المفاتيح المحفوظة عند تحميل المكون
    useEffect(() => {
        const savedCreds = localStorage.getItem('binanceCredentials');
        if (savedCreds) {
            try {
                const parsed = JSON.parse(savedCreds);
                setSavedCredentials(parsed);
            } catch (err) {
                console.error('خطأ في قراءة المفاتيح المحفوظة:', err);
            }
        }
    }, []);

    // حفظ المفاتيح الحالية
    const handleSaveCredential = () => {
        if (!credentialName || !apiKey || !secretKey) {
            setError('الرجاء إدخال الاسم والمفاتيح');
            return;
        }

        // التحقق من عدم وجود اسم مكرر
        if (savedCredentials.some(cred => cred.name === credentialName)) {
            setError('يوجد مفتاح محفوظ بهذا الاسم بالفعل');
            return;
        }

        const newCredential: SavedCredential = {
            name: credentialName,
            apiKey,
            secretKey
        };

        const updatedCredentials = [...savedCredentials, newCredential];
        setSavedCredentials(updatedCredentials);
        localStorage.setItem('binanceCredentials', JSON.stringify(updatedCredentials));
        
        setCredentialName('');
        setShowSaveForm(false);
        setError(null);
    };

    // حذف مفتاح محفوظ
    const handleDeleteCredential = (name: string) => {
        const updatedCredentials = savedCredentials.filter(cred => cred.name !== name);
        setSavedCredentials(updatedCredentials);
        localStorage.setItem('binanceCredentials', JSON.stringify(updatedCredentials));
        
        if (selectedCredential === name) {
            setSelectedCredential('');
        }
    };

    // اختيار مفتاح محفوظ
    const handleSelectCredential = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = e.target.value;
        setSelectedCredential(selected);
        
        if (selected) {
            const credential = savedCredentials.find(cred => cred.name === selected);
            if (credential) {
                setApiKey(credential.apiKey);
                setSecretKey(credential.secretKey);
            }
        }
    };

    // تعديل دالة الاتصال لتتحقق فقط من صحة المفاتيح دون جلب البيانات
    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey || !secretKey) {
            setError('الرجاء إدخال المفاتيح');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // التحقق من صحة المفاتيح فقط عن طريق استدعاء دالة التحقق من وقت السيرفر
            const service = new BinanceService(apiKey, secretKey);
            await service.checkServerTime();
            
            // إذا نجح الاتصال، نعين حالة الاتصال إلى true
            setIsConnected(true);
            setOrders([]);
            setFilteredOrders([]);
        } catch (err) {
            console.error('خطأ في الاتصال:', err);
            setError(err instanceof Error ? err.message : 'حدث خطأ في الاتصال مع Binance');
            setIsConnected(false);
        } finally {
            setLoading(false);
        }
    };

    // تعديل دالة جلب البيانات
    const handleFetchData = async (page: number = 1) => {
        if (!apiKey || !secretKey) {
            setError('الرجاء إدخال المفاتيح');
            return;
        }

        if (loadingState !== 'idle') {
            return;
        }

        console.log('=== Debug Component State ===');
        console.log('Start Date Input:', startDate);
        console.log('End Date Input:', endDate);

        if (page === 1) {
            setLoadingState('loading');
            setOrders([]);
            setFilteredOrders([]);
        } else {
            setLoadingState('loadingMore');
        }
        setError(null);

        try {
            const service = new BinanceService(apiKey, secretKey);
            
            if (startDate || endDate) {
                const startTimestamp = startDate ? new Date(startDate + 'T00:00:00').getTime() : undefined;
                const endTimestamp = endDate ? new Date(endDate + 'T23:59:59.999').getTime() : undefined;
                
                console.log('=== Debug Date Conversion ===');
                console.log('Start Date String:', startDate ? startDate + 'T00:00:00' : null);
                console.log('End Date String:', endDate ? endDate + 'T23:59:59.999' : null);
                console.log('Start Timestamp:', startTimestamp);
                console.log('End Timestamp:', endTimestamp);
                console.log('Start Date Converted:', startTimestamp ? new Date(startTimestamp).toISOString() : null);
                console.log('End Date Converted:', endTimestamp ? new Date(endTimestamp).toISOString() : null);
                
                service.setDateRange(startTimestamp, endTimestamp);
            }

            const response = await service.getP2POrders(page);
            
            console.log('=== Debug Response Orders ===');
            if (response.orders.length > 0) {
                console.log('First Order:', {
                    time: new Date(response.orders[0].createTime).toISOString(),
                    raw: response.orders[0].createTime
                });
                console.log('Last Order:', {
                    time: new Date(response.orders[response.orders.length - 1].createTime).toISOString(),
                    raw: response.orders[response.orders.length - 1].createTime
                });
            }

            if (page === 1) {
                setOrders(response.orders);
                applyFilters(response.orders);
            } else {
                const newOrders = [...orders, ...response.orders];
                setOrders(newOrders);
                applyFilters(newOrders);
            }
            
            setTotalPages(response.totalPages);
            setTotalOrders(response.total);
            setCurrentPage(page);

        } catch (err) {
            console.error('خطأ في جلب البيانات:', err);
            setError(err instanceof Error ? err.message : 'حدث خطأ في جلب البيانات من Binance');
        } finally {
            setLoadingState('idle');
        }
    };

    // تعديل دالة تطبيق الفلترة لتشمل الفلاتر الجديدة
    const applyFilters = (ordersToFilter = orders) => {
        let filtered = [...ordersToFilter];
        
        // فلتر نوع الأوردر (شراء/بيع)
        if (orderType !== 'ALL') {
            filtered = filtered.filter(order => order.type === orderType);
        }
        
        // فلتر حالة الأوردر
        if (orderStatus !== 'ALL') {
            filtered = filtered.filter(order => order.status === orderStatus);
        }
        
        // فلتر نوع الرسوم (ميكر/تيكر)
        if (orderFeeType !== 'ALL') {
            filtered = filtered.filter(order => {
                if (orderFeeType === 'TAKER') {
                    return order.fee === 0; // الأوردرات التي رسومها 0 هي تيكر (0.05)
                } else {
                    return order.fee > 0; // الأوردرات التي لها رسوم هي ميكر
                }
            });
        }
        
        // فلتر التاريخ
        if (startDate) {
            const startTimestamp = new Date(startDate).getTime();
            filtered = filtered.filter(order => order.createTime >= startTimestamp);
        }
        
        if (endDate) {
            const endTimestamp = new Date(endDate);
            endTimestamp.setHours(23, 59, 59, 999);
            filtered = filtered.filter(order => order.createTime <= endTimestamp.getTime());
        }
        
        setFilteredOrders(filtered);
    };

    // تطبيق الفلترة عند تغيير معايير الفلترة
    React.useEffect(() => {
        if (orders.length > 0) {
            applyFilters();
        }
    }, [orderType, orderStatus, orderFeeType, startDate, endDate, orders]);

    // إضافة مكون زر تحميل المزيد
    const LoadMoreButton = () => {
        if (currentPage >= totalPages) return null;
        
        return (
            <div className="mt-4 text-center">
                <button
                    onClick={() => handleFetchData(currentPage + 1)}
                    disabled={loadingState !== 'idle'}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                >
                    {loadingState === 'loadingMore' ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>جاري تحميل المزيد...</span>
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            <span>تحميل المزيد من الأوردرات</span>
                        </>
                    )}
                </button>
            </div>
        );
    };

    // تعديل زر جلب البيانات
    const fetchButton = (
        <button
            type="button"
            onClick={() => handleFetchData()}
            disabled={loadingState !== 'idle'}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
        >
            {loadingState === 'loading' ? (
                <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>جاري جلب البيانات...</span>
                </>
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>جلب البيانات</span>
                </>
            )}
        </button>
    );

    return (
        <div className="p-4">
            <form onSubmit={handleConnect} className="space-y-4">
                {/* قسم اختيار المفاتيح المحفوظة */}
                {savedCredentials.length > 0 && (
                    <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center gap-2">
                            <div className="flex-grow">
                                <label className="block text-sm font-semibold mb-1 text-right text-indigo-700">
                                    اختر مفتاح محفوظ
                                </label>
                                <select
                                    value={selectedCredential}
                                    onChange={handleSelectCredential}
                                    className="w-full p-2 border border-indigo-200 rounded-lg text-right focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all duration-200 outline-none"
                                >
                                    <option value="">-- اختر --</option>
                                    {savedCredentials.map(cred => (
                                        <option key={cred.name} value={cred.name}>
                                            {cred.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {selectedCredential && (
                                <button
                                    type="button"
                                    onClick={() => handleDeleteCredential(selectedCredential)}
                                    className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors duration-200 flex items-center justify-center gap-1 font-medium"
                                >
                                    <span>حذف</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="space-y-3 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-base font-bold mb-2 text-gray-800 text-right border-r-4 border-indigo-500 pr-3">بيانات الاتصال</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">
                                API Key
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all duration-200 pl-10"
                                    placeholder="أدخل API Key"
                                    disabled={isConnected}
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">
                                Secret Key
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={secretKey}
                                    onChange={(e) => setSecretKey(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all duration-200 pl-10"
                                    placeholder="أدخل Secret Key"
                                    disabled={isConnected}
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-2 pt-1">
                        {!isConnected ? (
                            <>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-grow bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-2 rounded-lg disabled:opacity-50 transition-all duration-200 hover:from-blue-600 hover:to-indigo-700 font-medium shadow-sm flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>جاري الاتصال...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            <span>اتصال</span>
                                        </>
                                    )}
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => setShowSaveForm(!showSaveForm)}
                                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-medium shadow-sm flex items-center justify-center gap-2"
                                >
                                    {showSaveForm ? (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            <span>إلغاء الحفظ</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                            </svg>
                                            <span>حفظ المفاتيح</span>
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsConnected(false);
                                    setOrders([]);
                                    setFilteredOrders([]);
                                }}
                                className="bg-gradient-to-r from-gray-500 to-gray-600 text-white p-2 rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 font-medium shadow-sm flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                                </svg>
                                <span>تغيير المفاتيح</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* نموذج حفظ المفاتيح */}
                {showSaveForm && (
                    <div className="mt-2 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 shadow-sm">
                        <h4 className="text-sm font-semibold mb-2 text-green-800 text-right">حفظ المفاتيح للاستخدام لاحقاً</h4>
                        <div className="mb-2">
                            <label className="block text-sm font-medium mb-1 text-right text-green-700">
                                اسم المفتاح
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={credentialName}
                                    onChange={(e) => setCredentialName(e.target.value)}
                                    className="w-full p-2 border border-green-200 rounded-lg text-right focus:ring-2 focus:ring-green-300 focus:border-green-500 transition-all duration-200 pl-10"
                                    placeholder="أدخل اسماً للمفتاح"
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleSaveCredential}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-700 text-white p-2 rounded-lg hover:from-green-700 hover:to-emerald-800 transition-all duration-200 font-medium shadow-sm flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>حفظ</span>
                        </button>
                    </div>
                )}
            </form>

            {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-sm flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            {/* قسم الفلترة - يظهر فقط بعد الاتصال الناجح */}
            {isConnected && (
                <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 shadow-sm">
                    <h3 className="text-base font-bold mb-3 text-right text-indigo-800 border-r-4 border-indigo-500 pr-3">فلترة الأوردرات</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-100">
                            <label className="block text-sm font-semibold mb-1 text-right text-indigo-700">
                                من تاريخ
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full p-2 border border-indigo-200 rounded-lg text-right focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all duration-200 pr-2"
                                />
                                <label 
                                    htmlFor="startDate" 
                                    className="absolute left-3 top-2.5 cursor-pointer"
                                    onClick={() => {
                                        const dateInput = document.querySelector('input[type="date"][value="' + startDate + '"]') as HTMLInputElement;
                                        if (dateInput) dateInput.showPicker();
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </label>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-100">
                            <label className="block text-sm font-semibold mb-1 text-right text-indigo-700">
                                إلى تاريخ
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full p-2 border border-indigo-200 rounded-lg text-right focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all duration-200 pr-2"
                                />
                                <label 
                                    htmlFor="endDate" 
                                    className="absolute left-3 top-2.5 cursor-pointer"
                                    onClick={() => {
                                        const dateInput = document.querySelector('input[type="date"][value="' + endDate + '"]') as HTMLInputElement;
                                        if (dateInput) dateInput.showPicker();
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </label>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-100">
                            <label className="block text-sm font-semibold mb-1 text-right text-indigo-700">
                                نوع الأوردر
                            </label>
                            <div className="relative">
                                <select
                                    value={orderType}
                                    onChange={(e) => setOrderType(e.target.value as 'ALL' | 'BUY' | 'SELL')}
                                    className="w-full p-2 border border-indigo-200 rounded-lg text-right focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all duration-200 appearance-none"
                                >
                                    <option value="ALL">الكل</option>
                                    <option value="BUY">شراء</option>
                                    <option value="SELL">بيع</option>
                                </select>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-100">
                            <label className="block text-sm font-semibold mb-1 text-right text-indigo-700">
                                حالة الأوردر
                            </label>
                            <div className="relative">
                                <select
                                    value={orderStatus}
                                    onChange={(e) => setOrderStatus(e.target.value as 'ALL' | 'COMPLETED' | 'CANCELLED')}
                                    className="w-full p-2 border border-indigo-200 rounded-lg text-right focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all duration-200 appearance-none"
                                >
                                    <option value="ALL">الكل</option>
                                    <option value="COMPLETED">مكتمل</option>
                                    <option value="CANCELLED">ملغي</option>
                                </select>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-100">
                            <label className="block text-sm font-semibold mb-1 text-right text-indigo-700">
                                نوع الرسوم
                            </label>
                            <div className="relative">
                                <select
                                    value={orderFeeType}
                                    onChange={(e) => setOrderFeeType(e.target.value as 'ALL' | 'MAKER' | 'TAKER')}
                                    className="w-full p-2 border border-indigo-200 rounded-lg text-right focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 transition-all duration-200 appearance-none"
                                >
                                    <option value="ALL">الكل</option>
                                    <option value="MAKER">ميكر</option>
                                    <option value="TAKER">تيكر</option>
                                </select>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    
                    {/* زر جلب البيانات */}
                    <div className="flex justify-center">
                        {fetchButton}
                    </div>
                </div>
            )}

            {/* عرض الأوردرات - يظهر فقط بعد جلب البيانات */}
            {filteredOrders.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                    <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-2 bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">
                            تم العثور على <span className="font-bold text-indigo-600">{filteredOrders.length}</span> من إجمالي <span className="font-bold text-indigo-600">{totalOrders}</span> أوردر
                        </div>
                        <div className="text-sm text-gray-600">
                            الصفحة <span className="font-bold text-indigo-600">{currentPage}</span> من <span className="font-bold text-indigo-600">{totalPages}</span>
                        </div>
                    </div>

                    <table className="min-w-full bg-white">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-4 text-center">#</th>
                                <th className="p-4 text-center">رقم الأوردر</th>
                                <th className="p-4 text-center">النوع</th>
                                <th className="p-4 text-center">المبلغ (جنيه)</th>
                                <th className="p-4 text-center">الكمية (USDT)</th>
                                <th className="p-4 text-center">اليوزد الفعلي</th>
                                <th className="p-4 text-center">السعر النهائي</th>
                                <th className="p-4 text-center">الرسوم (USDT)</th>
                                <th className="p-4 text-center">الحالة</th>
                                <th className="p-4 text-center">التاريخ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((order, index) => (
                                <tr 
                                    key={order.orderId}
                                    className={
                                        order.status === 'CANCELLED' ? 'bg-white' :
                                        order.type === 'BUY' ? 'bg-green-50' : 'bg-red-50'
                                    }
                                >
                                    <td className="p-4 text-center">{index + 1}</td>
                                    <td className="p-4">
                                        <span 
                                            className="cursor-pointer hover:text-blue-500"
                                            onClick={() => {
                                                navigator.clipboard.writeText(order.orderId);
                                            }}
                                            title="انقر للنسخ"
                                        >
                                            ...{order.orderId.slice(-5)}
                                        </span>
                                    </td>
                                    <td className="p-4">{order.type === 'BUY' ? 'شراء' : 'بيع'}</td>
                                    <td className="p-4">{order.fiatAmount.toFixed(2)}</td>
                                    <td className="p-4">{order.cryptoAmount.toFixed(2)}</td>
                                    <td className="p-4">{order.actualUsdt.toFixed(2)}</td>
                                    <td className="p-4">{(order.fiatAmount / order.actualUsdt).toFixed(2)}</td>
                                    <td className="p-4">
                                        {order.fee === 0 ? `0.05 🔄` : order.fee.toFixed(2)}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={
                                            order.status === 'COMPLETED' ? 'text-green-500' :
                                            order.status === 'CANCELLED' ? 'text-red-500' : 'text-gray-500'
                                        }>
                                            {order.status === 'COMPLETED' ? '✅' :
                                             order.status === 'CANCELLED' ? '❌' : '⏳'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {new Date(order.createTime).toLocaleString('en-GB', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                            hour12: false
                                        })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* زر تحميل المزيد */}
                    <LoadMoreButton />
                </div>
            )}
            
            {/* رسالة عندما لا توجد أوردرات بعد تطبيق الفلترة */}
            {orders.length > 0 && filteredOrders.length === 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded text-center">
                    لا توجد أوردرات تطابق معايير الفلترة
                </div>
            )}
        </div>
    );
};
