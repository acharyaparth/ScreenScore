import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button, Card } from '../components/shared';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card className="max-w-lg mx-auto text-center py-12">
      <h1 className="text-4xl md:text-5xl font-bold text-primary-400 mb-6">404</h1>
      <p className="text-xl md:text-2xl mb-8">
        The scene you're looking for isn't in this screenplay.
      </p>
      <Button
        variant="primary"
        leftIcon={<Home size={18} />}
        onClick={() => navigate('/')}
      >
        Back to Home
      </Button>
    </Card>
  );
};

export default NotFoundPage;