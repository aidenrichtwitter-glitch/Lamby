import React from 'react';

interface TestBatchButtonProps {
  label: string;
  onClick: () => void;
}

const TestBatchButton: React.FC<TestBatchButtonProps> = ({ label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-200"
    >
      {label}
    </button>
  );
};

export default TestBatchButton;