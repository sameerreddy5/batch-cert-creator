import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Navbar } from '@/components/Navbar';
import { CertificateBatch, Certificate } from '@/types';
import { 
  Download, 
  Search, 
  Eye, 
  Clock, 
  CheckCircle, 
  XCircle, 
  FileText,
  Calendar,
  User
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export const History = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<CertificateBatch[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<CertificateBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<CertificateBatch | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingCertificates, setLoadingCertificates] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBatches();
    }
  }, [user]);

  useEffect(() => {
    const filtered = batches.filter(batch =>
      batch.batch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (batch.template?.name && batch.template.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredBatches(filtered);
  }, [batches, searchTerm]);

  const fetchBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('certificate_batches')
        .select(`
          *,
          template:certificate_templates(name, template_type)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBatches(data || []);
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch certificate batches',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCertificates = async (batchId: string) => {
    setLoadingCertificates(true);
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (error) {
      console.error('Error fetching certificates:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch certificates',
        variant: 'destructive',
      });
    } finally {
      setLoadingCertificates(false);
    }
  };

  const handleViewBatch = (batch: CertificateBatch) => {
    setSelectedBatch(batch);
    fetchCertificates(batch.id);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Certificate History</h1>
            <p className="text-muted-foreground">
              View and manage your generated certificate batches
            </p>
          </div>
          <Button asChild>
            <Link to="/generate">
              <FileText className="h-4 w-4 mr-2" />
              Generate New Batch
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Batches List */}
          <div className="lg:col-span-2">
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search batches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Batches */}
            {filteredBatches.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchTerm ? 'No batches found' : 'No certificate batches yet'}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {searchTerm 
                      ? 'Try adjusting your search criteria'
                      : 'Create your first certificate batch to get started'
                    }
                  </p>
                  {!searchTerm && (
                    <Button asChild>
                      <Link to="/generate">
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Certificates
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredBatches.map((batch) => (
                  <Card 
                    key={batch.id}
                    className={`hover:shadow-md transition-shadow cursor-pointer ${
                      selectedBatch?.id === batch.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleViewBatch(batch)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center">
                          {getStatusIcon(batch.status)}
                          <span className="ml-2">{batch.batch_name}</span>
                        </CardTitle>
                        <Badge className={getStatusColor(batch.status)}>
                          {batch.status}
                        </Badge>
                      </div>
                      <CardDescription>
                        Template: {batch.template?.name || 'Unknown'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span>{batch.generated_certificates}/{batch.total_certificates} generated</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span>{format(new Date(batch.created_at), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                      
                      {batch.status === 'completed' && batch.batch_zip_url && (
                        <div className="mt-4">
                          <Button size="sm" variant="outline" className="w-full">
                            <Download className="h-4 w-4 mr-2" />
                            Download All Certificates
                          </Button>
                        </div>
                      )}
                      
                      {batch.error_message && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-600">{batch.error_message}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Certificate Details */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="h-5 w-5 mr-2" />
                  Certificate Details
                </CardTitle>
                <CardDescription>
                  {selectedBatch 
                    ? `Individual certificates for "${selectedBatch.batch_name}"`
                    : 'Select a batch to view individual certificates'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedBatch ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a batch from the list to view individual certificates</p>
                  </div>
                ) : loadingCertificates ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : certificates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No certificates found for this batch</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {certificates.map((certificate) => (
                      <div
                        key={certificate.id}
                        className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{certificate.recipient_name}</h4>
                          <Badge 
                            variant={certificate.status === 'generated' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {certificate.status}
                          </Badge>
                        </div>
                        {certificate.recipient_email && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {certificate.recipient_email}
                          </p>
                        )}
                        {certificate.certificate_url && certificate.status === 'generated' && (
                          <Button size="sm" variant="outline" className="w-full text-xs">
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        )}
                        {certificate.error_message && (
                          <p className="text-xs text-red-600 mt-2">{certificate.error_message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};